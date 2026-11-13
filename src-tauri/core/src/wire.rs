use crate::db::{Entry, Op};
use crate::error::{CoreError, CoreResult, ErrorKind};
use serde::Deserialize;

// Storage-backends data-model "Commit wire format": a raw body of `[u32 little-endian header length][JSON header][payloads one after another]`,
// so record bytes never travel as JSON numbers or base64 (R8). Listing results come back in the same shape.

#[derive(Deserialize)]
struct WireOp {
    op: String,
    collection: Option<String>,
    key: Option<String>,
    parent: Option<String>,
    sort: Option<String>,
    length: Option<usize>,
}

fn malformed(message: &str) -> CoreError {
    CoreError::new(ErrorKind::Io, message)
}

/// The ops of a commit body. A body that does not add up (short, long, unknown operation, missing field) is refused whole.
pub fn parse_commit_body(body: &[u8]) -> CoreResult<Vec<Op>> {
    let prefix: [u8; 4] = body.get(..4).and_then(|bytes| bytes.try_into().ok()).ok_or_else(|| malformed("The save request was cut short."))?;
    let header_length = u32::from_le_bytes(prefix) as usize;
    let header_end = 4usize.checked_add(header_length).filter(|end| *end <= body.len()).ok_or_else(|| malformed("The save request was cut short."))?;
    let wire_ops: Vec<WireOp> = serde_json::from_slice(&body[4..header_end]).map_err(|_| malformed("The save request could not be read."))?;
    let mut cursor = header_end;
    let mut ops = Vec::with_capacity(wire_ops.len());
    for wire in wire_ops {
        let collection = wire.collection.ok_or_else(|| malformed("The save request is missing a collection."))?;
        match wire.op.as_str() {
            "put" => {
                let key = wire.key.ok_or_else(|| malformed("The save request is missing a key."))?;
                let length = wire.length.ok_or_else(|| malformed("The save request is missing a length."))?;
                let end = cursor.checked_add(length).filter(|end| *end <= body.len()).ok_or_else(|| malformed("The save request was cut short."))?;
                ops.push(Op::Put { collection, key, parent: wire.parent, sort: wire.sort, value: body[cursor..end].to_vec() });
                cursor = end;
            }
            "remove" => ops.push(Op::Remove { collection, key: wire.key.ok_or_else(|| malformed("The save request is missing a key."))? }),
            "removeByParent" => ops.push(Op::RemoveByParent { collection, parent: wire.parent.ok_or_else(|| malformed("The save request is missing a parent."))? }),
            _ => return Err(malformed("The save request holds an operation the app does not know.")),
        }
    }
    if cursor != body.len() {
        return Err(malformed("The save request has bytes nobody asked for."));
    }
    Ok(ops)
}

/// A listing as a body: the header lists each entry's key, parent, sort and byte length; the values follow in the same order.
pub fn encode_entries(entries: &[Entry]) -> Vec<u8> {
    let header: Vec<serde_json::Value> = entries
        .iter()
        .map(|entry| {
            let mut item = serde_json::Map::new();
            item.insert("key".into(), entry.key.clone().into());
            if let Some(parent) = &entry.parent {
                item.insert("parent".into(), parent.clone().into());
            }
            if let Some(sort) = &entry.sort {
                item.insert("sort".into(), sort.clone().into());
            }
            item.insert("length".into(), entry.value.len().into());
            serde_json::Value::Object(item)
        })
        .collect();
    let header_bytes = serde_json::to_vec(&header).unwrap_or_default();
    let mut body = Vec::with_capacity(4 + header_bytes.len() + entries.iter().map(|entry| entry.value.len()).sum::<usize>());
    body.extend_from_slice(&(header_bytes.len() as u32).to_le_bytes());
    body.extend_from_slice(&header_bytes);
    for entry in entries {
        body.extend_from_slice(&entry.value);
    }
    body
}
