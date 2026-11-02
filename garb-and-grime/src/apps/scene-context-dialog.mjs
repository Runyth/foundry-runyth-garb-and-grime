import { SCENE_LEVEL_RATINGS } from "../constants.mjs";
import { SceneContextError } from "../context-service.mjs";
import { label } from "../util.mjs";

export async function openSceneContextDialog(services, scene = canvas?.scene) {
  if (!scene) return null;
  const profiles = services.registry.listEnvironmentProfiles();
  const status = services.contextService.getSceneContextStatus(scene);
  const current = status.context;
  const currentRatings = services.contextService.getLevelRatings(scene);
  const staleOption = status.staleProfileId
    ? `<option value="" selected disabled>${escapeHtml(game.i18n.format("GAG.ContextDialog.StaleProfile", { id: status.staleProfileId }))}</option>`
    : "";
  const profileOptions = profiles.map((profile) => `
    <option value="${escapeAttribute(profile.id)}" ${!status.staleProfileId && profile.id === current.id ? "selected" : ""}>
      ${escapeHtml(label(profile))}
    </option>`).join("");
  const ratingOptions = (selected) => SCENE_LEVEL_RATINGS.map((rating) => `
    <option value="${rating}" ${rating === selected ? "selected" : ""}>
      ${escapeHtml(game.i18n.localize(`GAG.SceneGuide.Ratings.${rating}`))}
    </option>`).join("");
  const levelRows = currentRatings.map((rating, level) => `
    <label>
      <span>${escapeHtml(game.i18n.localize(`GAG.Levels.${level}.Name`))}</span>
      <select name="rating.${level}">${ratingOptions(rating)}</select>
    </label>`).join("");
  const staleHint = status.staleProfileId
    ? `<p class="hint warning"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${escapeHtml(game.i18n.format("GAG.ContextDialog.StaleProfileHint", { id: status.staleProfileId }))}</p>`
    : "";
  const registryHint = profiles.length
    ? ""
    : `<p class="hint warning"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${escapeHtml(game.i18n.localize("GAG.ContextDialog.NoProfilesAvailable"))}</p>`;

  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("GAG.ContextDialog.Title") },
      content: `
        <div class="gag-dialog-form gag-context-dialog">
          <label>
            <span>${escapeHtml(game.i18n.localize("GAG.ContextDialog.Profile"))}</span>
            <select name="contextId" required>${staleOption}${profileOptions}</select>
          </label>
          ${staleHint}${registryHint}
          <label class="gag-checkbox">
            <input type="checkbox" name="useProfileDefaults" ${current.levelRatings ? "" : "checked"}>
            <span>${escapeHtml(game.i18n.localize("GAG.ContextDialog.UseProfileDefaults"))}</span>
          </label>
          <p class="hint">${escapeHtml(game.i18n.localize("GAG.ContextDialog.ClassificationHint"))}</p>
          <div class="gag-context-rating-form">${levelRows}</div>
        </div>`,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("Save"),
          icon: "fa-solid fa-floppy-disk",
          default: true,
          callback: async (_event, button) => readSceneContextDialogSubmission(button)
        },
        { action: "cancel", label: game.i18n.localize("Cancel"), callback: async () => null }
      ]
    });

    if (!result) return null;
    await services.contextService.setSceneContext(scene, result.contextId, result);
    const selectedProfile = services.registry.getEnvironmentProfile(result.contextId);
    ui.notifications.info(game.i18n.format("GAG.Notifications.ContextSet", {
      context: selectedProfile ? label(selectedProfile) : result.contextId
    }));
    return result;
  } catch (error) {
    if (!(error instanceof SceneContextError)) throw error;
    console.error(`[garb-and-grime] Scene Context failed (${error.code}).`, error);
    ui.notifications.error(error.message);
    return null;
  }
}

export function readSceneContextDialogSubmission(button) {
  const elements = button?.form?.elements;
  if (!elements || typeof elements.namedItem !== "function") {
    throw new SceneContextError(
      "form-unavailable",
      game.i18n.localize("GAG.Errors.SceneContextFormUnavailable")
    );
  }
  const value = (name) => elements.namedItem(name);
  const contextId = String(value("contextId")?.value ?? "").trim();
  const useProfileDefaults = Boolean(value("useProfileDefaults")?.checked);
  const levelRatings = [0, 1, 2, 3].map((level) => String(value(`rating.${level}`)?.value ?? "").trim());
  return { contextId, useProfileDefaults, levelRatings };
}

function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
