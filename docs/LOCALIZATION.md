# Localization

Runyth Garb & Grime uses Foundry VTT's native package localization system.

## Included languages

- German (`de`)
- English (`en`)

The active language is controlled by Foundry's **Language Preference** under **Game Settings → Configure Settings → Core Settings**. Runyth Garb & Grime intentionally does not maintain a separate language override, because a module-specific language would conflict with Foundry's consolidated translation dictionary and each user's normal language preference.

The Global Module Settings window shows the current Foundry language and the translations bundled with the installed release. No language switch is placed in the Cleanliness Manager.

## Adding another translation

1. Copy `lang/en.json` to `lang/<language-code>.json`.
2. Translate values only. Keep every `GAG.*` key and formatting placeholder unchanged.
3. Add the new language to the `languages` array in `module.json`.
4. Run `npm run check`.
5. Test the language through Foundry's Language Preference and reload the world.

Built-in cleaning methods, contamination definitions, environment profiles, notifications, dialogs, validation messages, and rules text use localization keys. Names and descriptions entered by a GM for custom definitions remain world-authored content and are not translated automatically.
