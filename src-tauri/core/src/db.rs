use crate::error::{CoreError, CoreResult, ErrorKind};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use std::path::Path;
use std::sync::Mutex;

// Storage-backends R5, R7, R17: `library.db`, one generic table. Rust knows collections, keys, a parent key and a sort key, and bytes: nothing about projects.

const SCHEMA_VERSION: i64 = 1;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  key TEXT NOT NULL,
  parent TEXT,
  sort TEXT,
  value BLOB NOT NULL,
  PRIMARY KEY (collection, key)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS records_parent ON records (collection, parent);
CREATE INDEX IF NOT EXISTS records_sort ON records (collection, sort);
CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
";

/// One change to the store. Applied in order, all or none.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Op {
    Put { collection: String, key: String, parent: Option<String>, sort: Option<String>, value: Vec<u8> },
    Remove { collection: String, key: String },
    RemoveByParent { collection: String, parent: String },
}

pub enum Query<'a> {
    /// By `sort`, largest first, equal sorts by key largest first; records without a `sort` are left out.
    SortDescending,
    /// That parent's records by key.
    Parent(&'a str),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entry {
    pub key: String,
    pub parent: Option<String>,
    pub sort: Option<String>,
    pub value: Vec<u8>,
}

pub struct Db {
    connection: Mutex<Connection>,
}

fn invalid(message: &str) -> CoreError {
    CoreError::new(ErrorKind::Io, message)
}

fn check_op(op: &Op) -> CoreResult<()> {
    let (collection, named) = match op {
        Op::Put { collection, key, .. } | Op::Remove { collection, key } => (collection, key),
        Op::RemoveByParent { collection, parent } => (collection, parent),
    };
    if collection.is_empty() || named.is_empty() {
        return Err(invalid("A record needs a collection and a key."));
    }
    Ok(())
}

fn apply(transaction: &rusqlite::Transaction<'_>, op: &Op) -> CoreResult<()> {
    check_op(op)?;
    match op {
        Op::Put { collection, key, parent, sort, value } => {
            transaction.prepare_cached("INSERT OR REPLACE INTO records (collection, key, parent, sort, value) VALUES (?1, ?2, ?3, ?4, ?5)")?.execute(params![collection, key, parent, sort, value])?;
        }
        Op::Remove { collection, key } => {
            transaction.prepare_cached("DELETE FROM records WHERE collection = ?1 AND key = ?2")?.execute(params![collection, key])?;
        }
        Op::RemoveByParent { collection, parent } => {
            transaction.prepare_cached("DELETE FROM records WHERE collection = ?1 AND parent = ?2")?.execute(params![collection, parent])?;
        }
    }
    Ok(())
}

impl Db {
    /// Opens (creating on first use) the library database for `app_id`. A database of the other app, or one written by a newer version, is refused.
    pub fn open(path: &Path, app_id: &str) -> CoreResult<Db> {
        let mut connection = Connection::open(path)?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let _mode: String = connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
        connection.pragma_update(None, "synchronous", "FULL")?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        transaction.execute_batch(SCHEMA)?;
        let stored_app: Option<String> = transaction.query_row("SELECT value FROM meta WHERE name = 'appId'", [], |row| row.get(0)).optional()?;
        match stored_app {
            Some(stored) if stored != app_id => return Err(CoreError::new(ErrorKind::WrongApp, "This library belongs to the other app.")),
            Some(_) => {}
            None => {
                transaction.execute("INSERT INTO meta (name, value) VALUES ('appId', ?1)", params![app_id])?;
                transaction.execute("INSERT OR IGNORE INTO meta (name, value) VALUES ('schemaVersion', ?1)", params![SCHEMA_VERSION.to_string()])?;
            }
        }
        let version: Option<String> = transaction.query_row("SELECT value FROM meta WHERE name = 'schemaVersion'", [], |row| row.get(0)).optional()?;
        if version.and_then(|text| text.parse::<i64>().ok()).unwrap_or(SCHEMA_VERSION) > SCHEMA_VERSION {
            return Err(invalid("This library was saved by a newer version of the app."));
        }
        transaction.commit()?;
        Ok(Db { connection: Mutex::new(connection) })
    }

    fn connection(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.connection.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn get(&self, collection: &str, key: &str) -> CoreResult<Option<Vec<u8>>> {
        Ok(self.connection().query_row("SELECT value FROM records WHERE collection = ?1 AND key = ?2", params![collection, key], |row| row.get(0)).optional()?)
    }

    pub fn list(&self, collection: &str, query: &Query<'_>) -> CoreResult<Vec<Entry>> {
        let connection = self.connection();
        let map = |row: &rusqlite::Row<'_>| Ok(Entry { key: row.get(0)?, parent: row.get(1)?, sort: row.get(2)?, value: row.get(3)? });
        let entries = match query {
            Query::SortDescending => connection
                .prepare_cached("SELECT key, parent, sort, value FROM records WHERE collection = ?1 AND sort IS NOT NULL ORDER BY sort DESC, key DESC")?
                .query_map(params![collection], map)?
                .collect::<Result<Vec<_>, _>>()?,
            Query::Parent(parent) => connection
                .prepare_cached("SELECT key, parent, sort, value FROM records WHERE collection = ?1 AND parent = ?2 ORDER BY key ASC")?
                .query_map(params![collection, parent], map)?
                .collect::<Result<Vec<_>, _>>()?,
        };
        Ok(entries)
    }

    /// Applies the ops in order as one transaction: any failing op, or a connection that goes away first, changes nothing. Commits are one at a time.
    pub fn commit(&self, ops: &[Op]) -> CoreResult<()> {
        if ops.is_empty() {
            return Ok(());
        }
        let mut connection = self.connection();
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        for op in ops {
            apply(&transaction, op)?; // an error drops the transaction, which rolls everything back
        }
        transaction.commit()?;
        Ok(())
    }
}
