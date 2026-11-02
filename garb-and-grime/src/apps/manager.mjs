import { MODULE_ID, MODULE_VERSION, PERMISSIONS, SETTINGS } from "../constants.mjs";
import { openSceneContextDialog } from "./scene-context-dialog.mjs";
import { canModifyActor, canViewActor, hasPermission } from "../permissions.mjs";
import { getConfiguration } from "../settings.mjs";
import { actorDisplayName, label, mapWithConcurrency, resolveActorAsync, scheduleApplicationRender, selectedActors } from "../util.mjs";
import { PersistentApplication } from "./persistent-app.mjs";
import { installActorImageFallback, reportActorImageIssues, resolveActorDisplayImage } from "../display-images.mjs";
import { buildActorFolderOptions, buildDashboardActorScope, playerLinkedCharacterActorIds } from "../actor-scope.mjs";

let services;

export function configureManagerServices(value) {
  services = value;
}

export class CleanlinessManager extends PersistentApplication {
  static DEFAULT_OPTIONS = {
    id: "garb-and-grime-manager",
    classes: ["garb-and-grime", "gag-window", "gag-manager"],
    position: { width: 1040, height: 740 },
    window: { icon: "fa-solid fa-shirt", title: "GAG.Manager.Title", resizable: true },
    actions: {
      switchTab: CleanlinessManager.onSwitchTab,
      openActor: CleanlinessManager.onOpenActor,
      clean: CleanlinessManager.onClean,
      adjust: CleanlinessManager.onAdjust,
      bulk: CleanlinessManager.onBulk,
      openSettings: CleanlinessManager.onOpenSettings,
      resetFilters: CleanlinessManager.onResetFilters,
      applyContext: CleanlinessManager.onApplyContext,
      toggleMaintenance: CleanlinessManager.onToggleMaintenance,
      migrate: CleanlinessManager.onMigrate,
      bulkContamination: CleanlinessManager.onBulkContamination,
      selectAllActors: CleanlinessManager.onSelectAllActors,
      clearActorSelection: CleanlinessManager.onClearActorSelection,
      bulkActorAdjust: CleanlinessManager.onBulkActorAdjust,
      bulkActorAction: CleanlinessManager.onBulkActorAction,
      selectActorGroup: CleanlinessManager.onSelectActorGroup,
      openSceneGuide: CleanlinessManager.onOpenSceneGuide,
      editSceneContext: CleanlinessManager.onEditSceneContext,
      changeActorPage: CleanlinessManager.onChangeActorPage
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/manager.hbs` }
  };

  async _prepareContext(options) {
    const uiState = foundry.utils.mergeObject(
      { activeTab: "overview", search: "", searchMode: "text", folderId: "all", includeSubfolders: true, actorType: "all", selectionMode: "all", level: "all", sort: "name", direction: "asc", actorPage: 1, actorPageSize: 40, selectedActorUuids: [] },
      game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {},
      { inplace: false }
    );
    const activeTab = uiState.activeTab;
    const configuration = getConfiguration();
    const scene = canvas?.scene;
    const sceneContextStatus = services.contextService.getSceneContextStatus(scene);
    const sceneContext = sceneContextStatus.context;
    const sceneProfile = services.contextService.getProfile(scene);
    const needsActors = activeTab === "overview" || activeTab === "actors";
    const selectedActorUuids = new Set(Array.isArray(uiState.selectedActorUuids) ? uiState.selectedActorUuids : []);
    const folderOptions = needsActors ? buildActorFolderOptions() : [];
    const folderPathById = needsActors ? new Map(folderOptions.map((entry) => [entry.id, entry.label])) : new Map();
    const baseActors = needsActors
      ? game.actors.filter((actor) => configuration.general.supportedActorTypes.includes(actor.type) && canViewActor(actor))
      : [];
    const actorScope = needsActors ? buildDashboardActorScope(configuration.general, folderOptions) : null;
    const playerLinkedActorIds = actorScope?.active
      ? playerLinkedCharacterActorIds({ actors: baseActors, users: game.users ?? [] })
      : new Set();
    let playerLinkedScopeBypassCount = 0;
    const actors = actorScope?.active
      ? baseActors.filter((actor) => {
          if (actorScope.matches(actor)) return true;
          if (!playerLinkedActorIds.has(actor.id)) return false;
          playerLinkedScopeBypassCount += 1;
          return true;
        })
      : baseActors;
    let actorScopeSummary = "";
    if (actorScope?.active) {
      const data = { scoped: actors.length, total: baseActors.length, folders: actorScope.selectedFolderIds.length, regex: actorScope.regexSource };
      const key = actorScope.folderActive && actorScope.regexActive
        ? "GAG.Manager.GlobalActorScopeBoth"
        : actorScope.folderActive
          ? "GAG.Manager.GlobalActorScopeFolders"
          : "GAG.Manager.GlobalActorScopeRegex";
      actorScopeSummary = game.i18n.format(key, data);
      if (playerLinkedScopeBypassCount > 0) {
        actorScopeSummary += ` ${game.i18n.format("GAG.Manager.GlobalActorScopePlayerLinked", { count: playerLinkedScopeBypassCount })}`;
      }
    }
    const contaminationDefinitions = needsActors
      ? new Map(services.registry.listContaminations({ clone: false }).map((entry) => [entry.id, entry]))
      : null;

    let rows = [];
    let actorGroups = [];
    let filteredResult = { rows: [], error: "" };
    let filteredCount = 0;
    let selectedActorCount = 0;
    let visibleSelectableCount = 0;
    let pagination = null;
    const countsByLevel = [0, 0, 0, 0];

    if (activeTab === "overview") {
      rows = actors.map((actor) => ({
        ...this.#overviewActorRow(actor, sceneProfile, contaminationDefinitions),
        selected: selectedActorUuids.has(actor.uuid)
      }));
      for (const row of rows) countsByLevel[row.level] += 1;
      filteredResult = { rows, error: "" };
      filteredCount = rows.length;
    } else if (activeTab === "actors") {
      const indexedRows = actors.map((actor) => {
        const row = this.#actorIndexRow(actor, contaminationDefinitions, folderPathById);
        const canModify = canModifyActor(actor);
        const selected = selectedActorUuids.has(actor.uuid);
        if (selected && canModify) selectedActorCount += 1;
        countsByLevel[row.level] += 1;
        return { ...row, canModify, selected };
      });
      filteredResult = this.#filterAndSort(indexedRows, uiState, folderOptions);
      const filtered = filteredResult.rows;
      filteredCount = filtered.length;
      for (const row of filtered) if (row.canModify) visibleSelectableCount += 1;
      pagination = paginateActorRows(filtered, uiState.actorPage, uiState.actorPageSize);
      uiState.actorPage = pagination.page;
      uiState.actorPageSize = pagination.pageSize;
      rows = pagination.rows.map((row) => this.#hydrateActorRow(row));
      actorGroups = groupActorRows(rows);
      reportActorImageIssues(rows);
    }

    const counts = countsByLevel.map((count, level) => ({ level, count }));
    const profiles = activeTab === "overview"
      ? [
          ...(sceneContextStatus.staleProfileId ? [{
            id: "",
            label: game.i18n.format("GAG.ContextDialog.StaleProfile", { id: sceneContextStatus.staleProfileId }),
            selected: true,
            disabled: true,
            stale: true
          }] : []),
          ...services.registry.listEnvironmentProfiles().map((profile) => ({
            ...profile,
            label: label(profile),
            selected: !sceneContextStatus.staleProfileId && profile.id === sceneContext.id,
            disabled: false
          }))
        ]
      : [];
    const contaminations = activeTab === "overview"
      ? services.registry.listContaminations().map((entry) => ({ ...entry, label: label(entry) }))
      : [];
    const canViewTransactions = game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS);
    const transactionLog = activeTab === "transactions" && canViewTransactions
      ? (game.settings.get(MODULE_ID, SETTINGS.TRANSACTION_LOG) ?? []).slice(-100).reverse().map((entry) => ({
          ...entry,
          timestampLabel: entry.timestamp ? new Date(entry.timestamp).toLocaleString() : game.i18n.localize("GAG.Common.Never")
        }))
      : [];
    return {
      uiState,
      tabs: ["overview", "actors", "rules", "transactions", "settings"].map((id) => ({
        id,
        label: game.i18n.localize(`GAG.Manager.Tabs.${id}`),
        active: activeTab === id,
        visible: id === "transactions" ? canViewTransactions : id !== "settings" || game.user.isGM
      })),
      rows,
      actorGroups,
      folderOptions,
      filterError: filteredResult.error || (actorScope?.regexError ? game.i18n.localize("GAG.Manager.InvalidGlobalActorRegex") : ""),
      filteredCount,
      allCount: actors.length,
      unscopedActorCount: baseActors.length,
      actorScopeActive: Boolean(actorScope?.active),
      actorScopeRegex: actorScope?.regexSource ?? "",
      actorScopeFolderCount: actorScope?.selectedFolderIds?.length ?? 0,
      actorScopeSummary,
      counts,
      profiles,
      contaminations,
      sceneName: scene?.name ?? game.i18n.localize("GAG.Common.NoScene"),
      sceneContextLabel: sceneContextStatus.staleProfileId
        ? game.i18n.format("GAG.ContextDialog.StaleProfile", { id: sceneContextStatus.staleProfileId })
        : label(sceneProfile),
      sceneRatings: services.contextService.getLevelRatingRows(scene).map(({ level, rating }) => ({
        level,
        levelLabel: game.i18n.localize(`GAG.Levels.${level}.Name`),
        rating,
        ratingLabel: game.i18n.localize(`GAG.SceneGuide.Ratings.${rating}`)
      })),
      selectedCount: activeTab === "overview" ? selectedActors().length : 0,
      selectedActorCount,
      visibleSelectableCount,
      pagination,
      canViewParty: game.user.isGM || hasPermission(PERMISSIONS.VIEW_PARTY),
      canBulk: game.user.isGM || hasPermission(PERMISSIONS.MODIFY_OTHERS),
      canConfigure: game.user.isGM && hasPermission(PERMISSIONS.MANAGE_SETTINGS),
      transactionLog,
      configuration,
      rulesHtml: activeTab === "rules" ? this.#rulesHtml() : "",
      version: game.modules.get(MODULE_ID)?.version ?? MODULE_VERSION
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    this._gagRenderListeners?.abort();
    this._gagRenderListeners = new AbortController();
    const listenerOptions = { signal: this._gagRenderListeners.signal };
    installActorImageFallback(root, listenerOptions);

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-gag-select-actor]")) {
        void this.#updateActorSelection(target).catch((error) => this.#reportUiError(error));
        return;
      }
      if (target.matches("[data-gag-filter]")) {
        void this.#updateFilter(target).catch((error) => this.#reportUiError(error));
      }
    }, listenerOptions);

    root.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("input[type=search][data-gag-filter]")) return;
      void this.#updateFilter(target, true).catch((error) => this.#reportUiError(error));
    }, listenerOptions);
    this.#restoreFilterFocus(root);
  }

  async _onClose(options) {
    this._gagRenderListeners?.abort();
    this._gagRenderListeners = null;
    clearTimeout(this._gagFilterTimer);
    this._gagFilterTimer = null;
    this._gagPendingFilterFocus = null;
    this._gagActorOperationQueue = null;
    this.invalidateActorCache();
    return super._onClose(options);
  }

  #reportUiError(error) {
    console.error(`[${MODULE_ID}] Manager interaction failed.`, error);
    ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
  }

  #overviewActorRow(actor, profile, contaminationDefinitions) {
    const state = services.stateService.getState(actor, { includeHidden: game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor }) });
    const evaluation = services.rollService.evaluateRollContext(actor, "ste", {
      enhancedSmell: true,
      state,
      profile,
      contaminations: contaminationDefinitions,
      emitHook: false
    });
    return {
      uuid: actor.uuid,
      name: actorDisplayName(actor),
      level: state.dirtLevel,
      levelLabel: game.i18n.localize(`GAG.Levels.${state.dirtLevel}.Name`),
      scentNotice: evaluation.mode !== "normal",
      canModify: canModifyActor(actor)
    };
  }

  #actorIndexRow(actor, contaminationDefinitions, folderPathById) {
    this._gagActorIndexCache ??= new Map();
    const cached = this._gagActorIndexCache.get(actor.uuid);
    if (cached) return cached;

    const state = services.stateService.getDirectorySummary(actor, { includeHidden: game.user.isGM || hasPermission(PERMISSIONS.VIEW_GM_DETAILS, { actor }) });
    const visibleContaminations = state.contaminations.map((entry) => {
      const definition = contaminationDefinitions?.get(entry.id) ?? services.registry.getContamination(entry.id, { clone: false });
      return { ...entry, label: definition ? label(definition) : entry.id };
    });
    const name = actorDisplayName(actor);
    const lastChangeTimestamp = Number(state.lastChange) || Date.parse(state.lastChange) || 0;
    const row = {
      actor,
      uuid: actor.uuid,
      id: actor.id,
      name,
      type: actor.type,
      folderId: actor.folder?.id ?? actor.folder ?? "root",
      folderPath: folderPathById.get(actor.folder?.id ?? actor.folder ?? "root") ?? game.i18n.localize("GAG.Manager.RootFolder"),
      level: state.dirtLevel,
      levelLabel: game.i18n.localize(`GAG.Levels.${state.dirtLevel}.Name`),
      levelDescription: game.i18n.localize(`GAG.Levels.${state.dirtLevel}.Description`),
      bodyLevel: state.bodyLevel,
      clothingLevel: state.clothingLevel,
      bodyLabel: game.i18n.localize(`GAG.Levels.${state.bodyLevel}.Name`),
      clothingLabel: game.i18n.localize(`GAG.Levels.${state.clothingLevel}.Name`),
      contaminations: visibleContaminations,
      autoMaintenance: state.autoMaintenance,
      lastChangeRaw: state.lastChange,
      lastChangeTimestamp,
      reason: state.lastChangeReason,
      searchText: `${name} ${visibleContaminations.map((entry) => entry.label).join(" ")}`.toLocaleLowerCase()
    };
    this._gagActorIndexCache.set(actor.uuid, row);
    return row;
  }

  #hydrateActorRow(row) {
    const displayImage = resolveActorDisplayImage(row.actor);
    return {
      ...row,
      actor: undefined,
      img: displayImage.src,
      imageSource: displayImage.requestedSrc,
      imageFallback: displayImage.fallback,
      imageIssue: displayImage.issue,
      lastChange: row.lastChangeRaw ? new Date(row.lastChangeRaw).toLocaleString() : game.i18n.localize("GAG.Common.Never")
    };
  }

  invalidateActor(actorOrUuid) {
    const uuid = typeof actorOrUuid === "string" ? actorOrUuid : actorOrUuid?.uuid;
    if (!uuid) return this.invalidateActorCache();
    this._gagActorIndexCache?.delete(uuid);
  }

  invalidateActorCache() {
    this._gagActorIndexCache?.clear();
  }

  #filterAndSort(rows, state, folderOptions) {
    const search = String(state.search ?? "").trim();
    const level = state.level === "all" ? null : Number(state.level);
    const folderId = String(state.folderId ?? "all");
    const actorType = String(state.actorType ?? "all");
    const selectionMode = String(state.selectionMode ?? "all");
    const selected = new Set(Array.isArray(state.selectedActorUuids) ? state.selectedActorUuids : []);
    let matcher = null;
    let error = "";
    if (search) {
      if (state.searchMode === "regex") {
        try { matcher = new RegExp(search, "iu"); }
        catch { error = game.i18n.localize("GAG.Manager.InvalidRegex"); }
      } else {
        const normalized = search.toLocaleLowerCase();
        matcher = { test: (value) => value.includes(normalized) };
      }
    }
    const allowedFolders = folderId === "all"
      ? null
      : new Set(folderOptions.filter((entry) => entry.id === folderId || (state.includeSubfolders && entry.ancestorIds.includes(folderId))).map((entry) => entry.id));
    let result = rows.filter((row) => {
      if (error) return false;
      if (matcher && !matcher.test(row.searchText)) return false;
      if (level !== null && row.level !== level) return false;
      if (actorType !== "all" && row.type !== actorType) return false;
      if (selectionMode === "selected" && !selected.has(row.uuid)) return false;
      if (allowedFolders && !allowedFolders.has(row.folderId)) return false;
      return true;
    });
    const direction = state.direction === "desc" ? -1 : 1;
    result.sort((a, b) => {
      if (state.sort === "level") return (a.level - b.level) * direction || a.name.localeCompare(b.name);
      if (state.sort === "updated") return (a.lastChangeTimestamp - b.lastChangeTimestamp) * direction || a.name.localeCompare(b.name);
      if (state.sort === "folder") return a.folderPath.localeCompare(b.folderPath) * direction || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name) * direction;
    });
    return { rows: result, error };
  }

  #rulesHtml() {
    const sections = [
      ["GAG.Rules.Title1", "GAG.Rules.Text1"],
      ["GAG.Rules.Title2", "GAG.Rules.Text2"],
      ["GAG.Rules.Title3", "GAG.Rules.Text3"]
    ];
    return sections.map(([title, text]) => `<section><h2>${foundry.utils.escapeHTML(game.i18n.localize(title))}</h2><p>${foundry.utils.escapeHTML(game.i18n.localize(text))}</p></section>`).join("");
  }

  async #updateFilter(element, debounce = false) {
    clearTimeout(this._gagFilterTimer);
    const filter = element.dataset.gagFilter;
    const value = element.type === "checkbox" ? element.checked : element.value;
    const hasFocus = document.activeElement === element;
    const focus = hasFocus ? {
      filter,
      start: element.selectionStart ?? null,
      end: element.selectionEnd ?? null
    } : null;
    const apply = async () => {
      const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
      state[filter] = value;
      state.actorPage = 1;
      this._gagPendingFilterFocus = focus;
      await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
      scheduleApplicationRender(this);
    };
    if (debounce) {
      this._gagFilterTimer = setTimeout(() => {
        void apply().catch((error) => {
          console.error(`[${MODULE_ID}] Failed to update manager filters.`, error);
          ui.notifications.error(error?.message ?? game.i18n.localize("GAG.Errors.Unexpected"));
        });
      }, 180);
    }
    else await apply();
  }

  #restoreFilterFocus(root) {
    const pending = this._gagPendingFilterFocus;
    this._gagPendingFilterFocus = null;
    if (!pending) return;
    const element = [...root.querySelectorAll("[data-gag-filter]")]
      .find((candidate) => candidate.dataset.gagFilter === pending.filter);
    if (!element) return;
    element.focus({ preventScroll: true });
    if (typeof element.setSelectionRange === "function" && pending.start !== null) {
      element.setSelectionRange(pending.start, pending.end ?? pending.start);
    }
  }


  async #updateActorSelection(element) {
    const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
    const selected = new Set(Array.isArray(state.selectedActorUuids) ? state.selectedActorUuids : []);
    if (element.checked) selected.add(element.dataset.gagSelectActor);
    else selected.delete(element.dataset.gagSelectActor);
    state.selectedActorUuids = [...selected];
    await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
    element.closest(".gag-actor-row")?.classList.toggle("selected", element.checked);
    this.#refreshActorSelectionSummary(selected.size);
  }

  #refreshActorSelectionSummary(count) {
    const summary = this.element.querySelector("[data-gag-selected-actor-count]");
    if (summary) summary.textContent = game.i18n.format("GAG.Manager.SelectedActorCount", { count });
    this.element.querySelectorAll("[data-action='bulkActorAdjust'], [data-action='bulkActorAction']").forEach((button) => { button.disabled = count < 1; });
  }

  static async onSwitchTab(event, target) {
    event.preventDefault();
    const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
    state.activeTab = target.dataset.tab;
    await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
    this.render({ force: true });
  }

  static async onChangeActorPage(event, target) {
    const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
    const current = Math.max(1, Math.trunc(Number(state.actorPage) || 1));
    const page = target.dataset.page ? Number(target.dataset.page) : current + Number(target.dataset.delta ?? 0);
    state.actorPage = Math.max(1, Math.trunc(page || 1));
    await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
    scheduleApplicationRender(this);
  }

  static async onOpenActor(event, target) {
    const actor = await resolveActorAsync(target.dataset.actorUuid);
    if (actor) services.openActorPanel(actor);
  }

  static async onClean(event, target) {
    const actor = await resolveActorAsync(target.dataset.actorUuid);
    if (!actor) return;
    await services.actionService.cleanActor(actor, target.dataset.methodId);
    scheduleApplicationRender(this);
  }

  static async onAdjust(event, target) {
    const actor = await resolveActorAsync(target.dataset.actorUuid);
    if (!actor) return;
    await services.stateService.adjustDirt(actor, Number(target.dataset.amount), { reason: game.i18n.localize("GAG.Actions.ManualAdjustment") });
    scheduleApplicationRender(this);
  }

  static async onBulk(event, target) {
    const actors = selectedActors();
    if (!actors.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
    const action = target.dataset.bulkAction;
    if (action === "clean") {
      await mapWithConcurrency(actors, (actor) => services.actionService.cleanActor(actor, "soap", { skipItemRequirements: true, waiveCost: true }));
    } else if (action === "water") {
      await mapWithConcurrency(actors, (actor) => services.actionService.cleanActor(actor, "water", { skipItemRequirements: true }));
    } else if (action === "context") {
      await services.automationService.applyContextExposure(actors);
    } else if (action === "normal" || action === "extreme" || action === "quiet") {
      await services.automationService.applyActivity(actors, action);
    } else {
      const amount = Number(target.dataset.amount ?? 0);
      await mapWithConcurrency(actors, (actor) => services.stateService.adjustDirt(actor, amount, { reason: game.i18n.localize("GAG.Actions.BulkAdjustment") }));
      ui.notifications.info(game.i18n.format("GAG.Notifications.BulkActorsAdjusted", { count: actors.length, amount: amount > 0 ? `+${amount}` : String(amount) }));
    }
    scheduleApplicationRender(this);
  }

  static async onBulkContamination() {
    const actors = selectedActors();
    if (!actors.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectTokens"));
    const id = this.element.querySelector("[name=bulkContaminationId]")?.value;
    if (!id) return;
    await mapWithConcurrency(actors, (actor) => services.stateService.applyContamination(actor, id, { increase: 1, reason: game.i18n.localize("GAG.Actions.ApplyContamination") }));
    ui.notifications.info(game.i18n.format("GAG.Notifications.BulkContaminationApplied", { count: actors.length }));
    scheduleApplicationRender(this);
  }

  static async onSelectAllActors() {
    return runActorManagerOperation(this, async () => {
      const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
      const selected = new Set(Array.isArray(state.selectedActorUuids) ? state.selectedActorUuids : []);
      this.element.querySelectorAll("[data-gag-select-actor]:not(:disabled)").forEach((checkbox) => selected.add(checkbox.dataset.gagSelectActor));
      state.selectedActorUuids = [...selected];
      await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
      scheduleApplicationRender(this);
    });
  }

  static async onClearActorSelection() {
    return runActorManagerOperation(this, async () => {
      const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
      state.selectedActorUuids = [];
      await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
      scheduleApplicationRender(this);
    });
  }

  static async onBulkActorAdjust(event, target) {
    return runActorManagerOperation(this, async () => {
      const actors = await selectedModifiableActors();
      if (!actors.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectActors"));
      const amount = Number(target.dataset.amount ?? 0);
      await mapWithConcurrency(actors, (actor) => services.stateService.adjustDirt(actor, amount, { reason: game.i18n.localize("GAG.Actions.BulkAdjustment") }));
      ui.notifications.info(game.i18n.format("GAG.Notifications.BulkActorsAdjusted", { count: actors.length, amount: amount > 0 ? `+${amount}` : String(amount) }));
      scheduleApplicationRender(this);
    });
  }

  static async onBulkActorAction(event, target) {
    return runActorManagerOperation(this, async () => {
      const actors = await selectedModifiableActors();
      if (!actors.length) return ui.notifications.warn(game.i18n.localize("GAG.Notifications.SelectActors"));
      const action = target.dataset.actorAction;
      if (action === "water") await mapWithConcurrency(actors, (actor) => services.actionService.cleanActor(actor, "water", { skipItemRequirements: true }));
      else if (action === "clean") await mapWithConcurrency(actors, (actor) => services.actionService.cleanActor(actor, "soap", { skipItemRequirements: true, waiveCost: true }));
      else if (action === "maintenance-on" || action === "maintenance-off") {
        const enabled = action === "maintenance-on";
        await mapWithConcurrency(actors, (actor) => services.stateService.setAutomaticMaintenance(actor, enabled, { system: true, reason: game.i18n.localize("GAG.Actions.ToggleMaintenance") }));
      }
      const actionLabel = action === "water"
        ? game.i18n.localize("GAG.Methods.Water.Name")
        : action === "clean"
          ? game.i18n.localize("GAG.Actions.CleanFully")
          : action === "maintenance-on"
            ? game.i18n.localize("GAG.Actions.EnableMaintenance")
            : game.i18n.localize("GAG.Actions.DisableMaintenance");
      ui.notifications.info(game.i18n.format("GAG.Notifications.BulkActorActionComplete", { count: actors.length, action: actionLabel }));
      scheduleApplicationRender(this);
    });
  }

  static async onSelectActorGroup(event, target) {
    return runActorManagerOperation(this, async () => {
      const group = target.closest("[data-gag-actor-group]");
      if (!group) return;
      const state = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {});
      const selected = new Set(Array.isArray(state.selectedActorUuids) ? state.selectedActorUuids : []);
      group.querySelectorAll("[data-gag-select-actor]:not(:disabled)").forEach((checkbox) => selected.add(checkbox.dataset.gagSelectActor));
      state.selectedActorUuids = [...selected];
      await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, state);
      scheduleApplicationRender(this);
    });
  }

  static onOpenSceneGuide() {
    void services.openSceneGuide();
  }

  static async onEditSceneContext() {
    await openSceneContextDialog(services);
    scheduleApplicationRender(this);
  }

  static onOpenSettings() {
    services.openSettings();
  }

  static async onResetFilters() {
    const current = game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {};
    await game.settings.set(MODULE_ID, SETTINGS.UI_STATE, { activeTab: "actors", search: "", searchMode: "text", folderId: "all", includeSubfolders: true, actorType: "all", selectionMode: "all", level: "all", sort: "name", direction: "asc", actorPage: 1, actorPageSize: 40, selectedActorUuids: current.selectedActorUuids ?? [] });
    scheduleApplicationRender(this);
  }

  static async onApplyContext(event, target) {
    const select = this.element.querySelector("[name=sceneContext]");
    if (!canvas?.scene || !select?.value) return;
    await services.contextService.setSceneContext(canvas.scene, select.value);
    ui.notifications.info(game.i18n.format("GAG.Notifications.ContextSet", { context: label(services.registry.getEnvironmentProfile(select.value)) }));
    scheduleApplicationRender(this);
  }

  static async onToggleMaintenance(event, target) {
    const actor = await resolveActorAsync(target.dataset.actorUuid);
    if (!actor) return;
    const state = services.stateService.getState(actor, { includeHidden: true });
    await services.stateService.setAutomaticMaintenance(actor, !state.autoMaintenance, { reason: game.i18n.localize("GAG.Actions.ToggleMaintenance") });
    scheduleApplicationRender(this);
  }

  static async onMigrate() {
    if (!game.user.isGM) return;
    const results = await mapWithConcurrency(game.actors, (actor) => services.stateService.migrateActor(actor));
    const migrated = results.filter((result) => result.migrated).length;
    ui.notifications.info(game.i18n.format("GAG.Notifications.Migrated", { count: migrated }));
  }
}


async function selectedModifiableActors() {
  const state = game.settings.get(MODULE_ID, SETTINGS.UI_STATE) ?? {};
  const selected = Array.isArray(state.selectedActorUuids) ? state.selectedActorUuids : [];
  const resolved = await mapWithConcurrency(selected, (uuid) => resolveActorAsync(uuid), { concurrency: 8 });
  return resolved.filter((actor) => actor && canModifyActor(actor));
}

/**
 * Serialize Actor-browser mutations so rapid repeated clicks preserve order, and
 * contain failures because ApplicationV2 does not provide a module-specific
 * rejection boundary for action handlers.
 */
async function runActorManagerOperation(app, operation) {
  const previous = app?._gagActorOperationQueue ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(operation);
  const guarded = task.catch((error) => {
    console.error(`[${MODULE_ID}] Actor dashboard action failed.`, error);
    ui.notifications.error(game.i18n.localize("GAG.Errors.ActorManagerActionFailed"));
    return undefined;
  });
  if (app) app._gagActorOperationQueue = guarded;
  return guarded;
}


function paginateActorRows(rows, pageValue, pageSizeValue) {
  const allowedPageSizes = new Set([20, 40, 80, 120]);
  const requestedSize = Math.trunc(Number(pageSizeValue) || 40);
  const pageSize = allowedPageSizes.has(requestedSize) ? requestedSize : 40;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(Number(pageValue) || 1)));
  const startIndex = rows.length ? (page - 1) * pageSize : 0;
  const endIndex = Math.min(rows.length, startIndex + pageSize);
  return {
    rows: rows.slice(startIndex, endIndex),
    page,
    pageSize,
    pageCount,
    start: rows.length ? startIndex + 1 : 0,
    end: endIndex,
    hasPrevious: page > 1,
    hasNext: page < pageCount
  };
}

function groupActorRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.folderId || "root";
    if (!groups.has(key)) groups.set(key, { id: key, label: row.folderPath, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
