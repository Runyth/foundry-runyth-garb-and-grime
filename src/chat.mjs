import { MODULE_ID, PERMISSIONS } from "./constants.mjs";
import { escapeHtml, label } from "./util.mjs";
import { hasPermission } from "./permissions.mjs";

function authorizedRecipients(permission, { hidden = false } = {}) {
  const recipients = [];
  for (const user of game.users ?? []) {
    if (!user?.id) continue;
    if (user.isGM || (!hidden && hasPermission(permission, { user }))) recipients.push(user.id);
  }
  return [...new Set(recipients)];
}

export async function postActionCard({
  actor,
  previous,
  next,
  method = null,
  reason = "",
  cost = null,
  consumed = [],
  hidden = false,
  titleKey = "GAG.Chat.StateChanged",
  permission = PERMISSIONS.VIEW_STATE_CHAT
}) {
  const whisper = authorizedRecipients(permission, { hidden });
  if (!whisper.length) return null;
  const levelLabel = (level) => game.i18n.localize(`GAG.Levels.${level}.Name`);
  const content = `
    <section class="gag-chat-card">
      <header><img src="modules/${MODULE_ID}/assets/icons/grime.svg" alt=""><h3>${escapeHtml(game.i18n.localize(titleKey))}</h3></header>
      <dl>
        <dt>${escapeHtml(game.i18n.localize("GAG.Common.Actor"))}</dt><dd>${escapeHtml(actor.name)}</dd>
        <dt>${escapeHtml(game.i18n.localize("GAG.Common.Previous"))}</dt><dd>${escapeHtml(levelLabel(previous.dirtLevel))}</dd>
        <dt>${escapeHtml(game.i18n.localize("GAG.Common.New"))}</dt><dd>${escapeHtml(levelLabel(next.dirtLevel))}</dd>
        ${method ? `<dt>${escapeHtml(game.i18n.localize("GAG.Common.Method"))}</dt><dd>${escapeHtml(label(method))}</dd>` : ""}
        ${reason ? `<dt>${escapeHtml(game.i18n.localize("GAG.Common.Reason"))}</dt><dd>${escapeHtml(reason)}</dd>` : ""}
        ${cost ? `<dt>${escapeHtml(game.i18n.localize("GAG.Common.Cost"))}</dt><dd>${escapeHtml(`${cost.amount} ${cost.currency}`)}</dd>` : ""}
        ${consumed.length ? `<dt>${escapeHtml(game.i18n.localize("GAG.Common.Consumed"))}</dt><dd>${consumed.map(escapeHtml).join(", ")}</dd>` : ""}
      </dl>
    </section>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper,
    flags: { [MODULE_ID]: { actionCard: true } }
  });
}
