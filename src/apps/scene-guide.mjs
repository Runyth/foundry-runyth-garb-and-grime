import { MODULE_ID, SETTINGS } from "../constants.mjs";
import { label, scheduleApplicationRender } from "../util.mjs";
import { PersistentApplication } from "./persistent-app.mjs";
import { openSceneContextDialog } from "./scene-context-dialog.mjs";

let services;

export function configureSceneGuideServices(value) {
  services = value;
}

export class SceneCleanlinessGuide extends PersistentApplication {
  static DEFAULT_OPTIONS = {
    id: "garb-and-grime-scene-guide",
    classes: ["runyth-garb-and-grime", "gag-window", "gag-scene-guide"],
    position: { width: 380, height: 390 },
    window: {
      icon: "fa-solid fa-signs-post",
      title: "GAG.SceneGuide.Title",
      resizable: true
    },
    actions: {
      openManager: SceneCleanlinessGuide.onOpenManager,
      editContext: SceneCleanlinessGuide.onEditContext
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/scene-guide.hbs` }
  };

  async _prepareContext() {
    const scene = canvas?.scene;
    const profile = services.contextService.getProfile(scene);
    const rows = services.contextService.getLevelRatingRows(scene).map(({ level, rating }) => ({
      level,
      levelLabel: game.i18n.localize(`GAG.Levels.${level}.Name`),
      rating,
      ratingLabel: game.i18n.localize(`GAG.SceneGuide.Ratings.${rating}`)
    }));
    return {
      sceneName: scene?.name ?? game.i18n.localize("GAG.Common.NoScene"),
      profileLabel: label(profile),
      profileDescription: profile?.descriptionKey ? game.i18n.localize(profile.descriptionKey) : String(profile?.description ?? ""),
      rows,
      canConfigure: game.user.isGM
    };
  }

  async _onClose(options) {
    if (game?.settings) await game.settings.set(MODULE_ID, SETTINGS.SCENE_GUIDE_VISIBLE, false);
    return super._onClose(options);
  }

  static onOpenManager() {
    services.openManager();
  }

  static async onEditContext() {
    await openSceneContextDialog(services);
    scheduleApplicationRender(this);
  }
}
