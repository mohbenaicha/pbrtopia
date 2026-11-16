//! Api-keys R21 (a): reads one environment variable for the page's key source. The page asks for a name; the value comes back only to it and is never logged here.
//! There is no rule on names (R15): whatever is asked is looked up, and a name the system cannot hold (empty, `=` or NUL in it) is simply not set.

use crate::wire_error::CommandResult;

/// The variable's value as the app was started with it (so one set later needs a restart), or `None` when it is not set or empty.
#[tauri::command]
pub async fn env_read(name: String) -> CommandResult<Option<String>> {
    Ok(std::env::var(&name).ok().filter(|value| !value.trim().is_empty()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(name: &str) -> Option<String> {
        tauri::async_runtime::block_on(env_read(name.to_string())).ok().flatten()
    }

    #[test]
    fn r21_an_unset_variable_is_none_and_a_set_one_is_returned() {
        std::env::remove_var("TEXTURIUM_TEST_UNSET");
        std::env::set_var("TEXTURIUM_TEST_SET", "value-123");
        std::env::set_var("TEXTURIUM_TEST_EMPTY", "  ");
        assert_eq!(run("TEXTURIUM_TEST_UNSET"), None);
        assert_eq!(run("TEXTURIUM_TEST_SET"), Some("value-123".to_string()));
        assert_eq!(run("TEXTURIUM_TEST_EMPTY"), None);
    }

    #[test]
    fn r15_any_name_is_looked_up_and_one_the_system_cannot_hold_is_none() {
        std::env::set_var("TEXTURIUM_TEST_ANY_NAME", "v");
        assert_eq!(run("TEXTURIUM_TEST_ANY_NAME"), Some("v".to_string()));
        for name in ["", "A=B", "A\0B"] {
            assert_eq!(run(name), None, "{name:?}");
        }
    }
}
