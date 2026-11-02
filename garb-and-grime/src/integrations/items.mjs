import { FLAGS, MODULE_ID, PERMISSIONS } from "../constants.mjs";
import { hasPermission } from "../permissions.mjs";
import { getRootElement } from "../util.mjs";

export function registerItemIntegrationHooks(services) {
  const render = (app, html) => {
    const item = app.item ?? app.document;
    if (item?.documentName !== "Item") return;
    // Prefer the complete sheet root so partial renders cannot insert a second
    // tool strip into a detached fragment.
    const root = getRootElement(app?.element) ?? getRootElement(html);
    if (!root || root.querySelector("[data-gag-item-tools]")) return;
    const integration = resolveItemIntegration(item, services.registry);
    if (!integration && !game.user.isGM) return;

    const tools = document.createElement("div");
    tools.className = "gag-item-tools";
    tools.dataset.gagItemTools = "true";

    if (game.user.isGM) {
      const select = document.createElement("select");
      select.setAttribute("aria-label", game.i18n.localize("GAG.Items.Integration"));
      select.innerHTML = [
        `<option value="">${foundry.utils.escapeHTML(game.i18n.localize("GAG.Items.NoIntegration"))}</option>`,
        ...services.registry.listItemIntegrations({ clone: false }).map((entry) => {
          const selected = entry.id === integration?.id ? " selected" : "";
          const text = entry.labelKey ? game.i18n.localize(entry.labelKey) : entry.label ?? entry.id;
          return `<option value="${foundry.utils.escapeHTML(entry.id)}"${selected}>${foundry.utils.escapeHTML(text)}</option>`;
        })
      ].join("");
      const save = document.createElement("button");
      save.type = "button";
      save.innerHTML = `<i class="fa-solid fa-link" aria-hidden="true"></i><span>${foundry.utils.escapeHTML(game.i18n.localize("GAG.Items.SaveIntegration"))}</span>`;
      save.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          if (select.value) await item.setFlag(MODULE_ID, FLAGS.ITEM_INTEGRATION, select.value);
          else await item.unsetFlag(MODULE_ID, FLAGS.ITEM_INTEGRATION);
          ui.notifications.info(game.i18n.localize("GAG.Notifications.ItemIntegrationSaved"));
        } catch (error) {
          console.error(`[${MODULE_ID}] Item integration could not be saved.`, error);
          ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
        }
      });
      tools.append(select, save);
    }

    if (integration && item.actor && (game.user.isGM || hasPermission(PERMISSIONS.CONSUME_ITEMS, { actor: item.actor }))) {
      const use = document.createElement("button");
      use.type = "button";
      use.className = "gag-use-item";
      use.dataset.gagUseItem = "true";
      use.innerHTML = `<i class="fa-solid fa-soap" aria-hidden="true"></i><span>${foundry.utils.escapeHTML(game.i18n.localize("GAG.Items.UseForCleaning"))}</span>`;
      use.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          await useItemIntegration(item, services);
        } catch (error) {
          console.error(`[${MODULE_ID}] Item integration action failed.`, error);
          ui.notifications.error(error.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
        }
      });
      tools.append(use);
    }

    const content = root.querySelector(".window-content") ?? root.querySelector("form") ?? root;
    content.prepend(tools);
  };
  // Restrict augmentation to actual Item-sheet hooks. Generic ApplicationV2
  // hooks can also represent advancement and configuration dialogs which happen
  // to carry an Item document.
  Hooks.on("renderItemSheet", render);
  Hooks.on("renderItemSheetV2", render);
}

export function resolveItemIntegration(item, registry) {
  const flagged = item.getFlag?.(MODULE_ID, FLAGS.ITEM_INTEGRATION);
  if (flagged) return registry.getItemIntegration(flagged, { clone: false });
  const normalizedName = String(item.name ?? "").trim().toLocaleLowerCase();
  for (const entry of registry.listItemIntegrations({ clone: false })) {
    if ((entry.aliases ?? []).some((alias) => normalizedName === String(alias).trim().toLocaleLowerCase())) return entry;
  }
  return null;
}

export async function useItemIntegration(item, services) {
  const integration = resolveItemIntegration(item, services.registry);
  if (!integration || !item.actor) throw new Error(game.i18n.localize("GAG.Errors.ItemIntegrationMissing"));
  const consume = Math.max(0, Number(integration.consume ?? 0));
  if (integration.methodId) {
    return services.actionService.cleanActor(item.actor, integration.methodId, {
      waiveCost: Boolean(integration.waiveCost),
      skipItemRequirements: true,
      source: item.uuid,
      consumeItemUuid: consume ? item.uuid : null,
      consumeItemQuantity: consume,
      consumed: consume ? [`${item.name} ×${consume}`] : []
    });
  }
  if (integration.masking) {
    if (consume) {
      const current = Number(foundry.utils.getProperty(item, "system.quantity") ?? 1);
      if (current < consume) throw new Error(game.i18n.format("GAG.Errors.RequiredItemMissing", { item: item.name }));
      await item.update({ "system.quantity": Math.max(0, current - consume) }, { garbAndGrime: true });
    }
    const result = await services.actionService.applyMasking(item.actor, integration.masking, { source: item.uuid });
    ui.notifications.info(game.i18n.format("GAG.Notifications.MaskingApplied", { actor: item.actor.name, item: item.name }));
    return result;
  }
  return null;
}
