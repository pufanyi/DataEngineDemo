"use strict";

const byId = (id) => document.getElementById(id);
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const safeMedia = (path) => typeof path === "string" && /^(videos|posters)\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(path)
  && !path.split("/").includes("..") ? path : "";
const num = (value, digits = 0) => Number.isFinite(value)
  ? value.toLocaleString("en", { maximumFractionDigits: digits, minimumFractionDigits: digits })
  : "–";
const percentage = (value) => Number.isFinite(value) ? `${num(value, 1)}%` : "–";
const metric = (value, suffix, digits = 1) => Number.isFinite(value) ? `${num(value, digits)} ${suffix}` : "–";
const statusLabel = (value) => ({
  accepted: "Passed", completed: "Completed", missing: "Missing", pending: "Pending",
  execution_failed: "Execution failed", goal_failed: "Goal failed", timed_out: "Timed out",
  planning_failed: "Planning failed", initialization_error: "Initialization error",
  placement_failed: "Scene sampling failed", scene_unstable: "Scene unstable",
  invalid_config: "Invalid configuration", asset_error: "Asset error",
  storage_failed: "Recording failed", skipped: "Skipped by quota", unsupported: "Unsupported",
})[value] ?? String(value ?? "Missing").replaceAll("_", " ");
const statusClass = (value) => value === "accepted" || value === "completed" ? "pass"
  : !value || ["missing", "pending", "skipped"].includes(value) ? "" : "fail";
const seedLabel = (value) => String(value).padStart(2, "0");
const attemptKey = (attempt) => attempt.seed ?? attempt.ordinal;
const sampleLabel = (task) => task.study === "push_t" ? "Trial" : "Seed";
const attemptLabel = (task, status) => status === "accepted" && task.stats.metric === "execution_completion"
  ? "Completed" : statusLabel(status);
const readable = (value) => String(value ?? "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const yamlName = (task) => task.source?.split("/").at(-1) ?? `${task.id}.yaml`;
const minutes = (seconds) => Number.isFinite(seconds) ? `${num(seconds / 60, 1)} min` : "–";

const ICONS = {
  all: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="10.5" y="2.5" width="5" height="5" rx="1"/><rect x="2.5" y="10.5" width="5" height="5" rx="1"/><rect x="10.5" y="10.5" width="5" height="5" rx="1"/></svg>',
  pick_transport: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5h10M11 9.5l3 3-3 3"/><path d="M5 7V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V7"/></svg>',
  container_sorting: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5h12l-1.2 7.5H4.2L3 7.5Z"/><path d="M6.5 4.5h5M9 2.5v5"/></svg>',
  stack_nest: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="11.5" width="12" height="3.5" rx="1"/><rect x="4.5" y="7.5" width="9" height="3.5" rx="1"/><rect x="6" y="3.5" width="6" height="3.5" rx="1"/></svg>',
  precision_assembly: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6"/><circle cx="9" cy="9" r="2.2"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2"/></svg>',
  push_align: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h10M10 5.5L13.5 9 10 12.5"/><path d="M15 4.5v9"/></svg>',
  fluid_interactive: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5c2.8 3.6 4.5 6 4.5 8.2a4.5 4.5 0 1 1-9 0c0-2.2 1.7-4.6 4.5-8.2Z"/></svg>',
  other: '<svg viewBox="0 0 18 18" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.2l1.3 1.5H14a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 13v-7.5Z"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>',
};

const CATEGORIES = [
  {
    id: "pick_transport",
    title: "Pick & Transport",
    description: "Single-arm lifting, cross-table handoffs, object swapping, and dynamic conveyor grasping.",
    families: ["pick_up_objects", "pick_left_place_right", "pick_right_place_left", "swap_objects", "conveyor_pick_cube"],
  },
  {
    id: "container_sorting",
    title: "Container & Sorting",
    description: "Packing bottles and target objects into containers and arranging ordered digit tiles.",
    families: ["object_in_container", "bottles_in_box", "bottle_in_container", "arrange_largest_number"],
  },
  {
    id: "stack_nest",
    title: "Stack, Nest & Cover",
    description: "Multi-stage vertical stacking, concentric bowl nesting, and inverted cup covering.",
    families: ["stack_three_cube", "stack_three_bowls", "nest_three_bowls", "cover_cube_with_cup"],
  },
  {
    id: "precision_assembly",
    title: "Precision & Assembly",
    description: "Tight-tolerance insertion, bimanual penholder placement, tube racking, and screw fastening.",
    families: ["pen_in_penholder", "insert_tubes", "fasten_screws", "insert_key"],
  },
  {
    id: "push_align",
    title: "Push & Align",
    description: "Non-prehensile tabletop pushing across the workspace and T-block pose alignment.",
    families: ["push_left_to_right", "push_right_to_left", "push_t"],
  },
  {
    id: "fluid_interactive",
    title: "Fluid & Interactive",
    description: "Pouring liquid into cups and bimanual button selection and pressing.",
    families: ["pour_liquid_into_cup", "press_button"],
  },
];

const FAMILY_TO_CATEGORY = new Map();
for (const cat of CATEGORIES) {
  for (const fam of cat.families) FAMILY_TO_CATEGORY.set(fam, cat.id);
}

function getCategoryId(task) {
  return FAMILY_TO_CATEGORY.get(task.family) ?? "other";
}

function getCategoryMeta(catId) {
  return CATEGORIES.find((c) => c.id === catId) ?? {
    id: "other",
    title: "Other Tasks",
    description: "Additional RoboDojo task folders.",
    families: [],
  };
}

function folderKey(task) {
  return task.family || task.id;
}

function folderLabel(family, tasks) {
  if (tasks?.[0]?.study === "push_t") return "robodojo_push_t";
  return `${family}/`;
}

function taskRate(task) {
  return task.stats?.successRate ?? task.stats?.executionRate ?? null;
}

function rateTier(rate) {
  if (!Number.isFinite(rate)) return "neutral";
  if (rate >= 65) return "high";
  if (rate >= 30) return "mid";
  return "low";
}

function bestPosterForTasks(tasks) {
  for (const task of tasks) {
    const passAttempt = (task.attempts ?? []).find((a) => a.status === "accepted" && safeMedia(a.poster));
    if (passAttempt) return safeMedia(passAttempt.poster);
  }
  for (const task of tasks) {
    const anyAttempt = (task.attempts ?? []).find((a) => safeMedia(a.poster));
    if (anyAttempt) return safeMedia(anyAttempt.poster);
  }
  return "";
}

function aggregateFolderStats(tasks) {
  let accepted = 0;
  let completed = 0;
  let expected = 0;
  let failed = 0;
  let skipped = 0;
  let missing = 0;
  let mediaEpisodes = 0;
  const renderFpsList = [];
  for (const t of tasks) {
    const s = t.stats ?? {};
    accepted += s.accepted ?? 0;
    completed += s.completed ?? 0;
    expected += s.expected ?? 0;
    failed += s.failed ?? 0;
    skipped += s.skipped ?? 0;
    missing += s.missing ?? 0;
    mediaEpisodes += s.mediaEpisodes ?? 0;
    if (Number.isFinite(s.renderFps)) renderFpsList.push(s.renderFps);
  }
  const rate = completed > 0 ? (100 * accepted) / completed : null;
  const avgRenderFps = renderFpsList.length
    ? renderFpsList.reduce((a, b) => a + b, 0) / renderFpsList.length
    : null;
  return { accepted, completed, expected, failed, skipped, missing, mediaEpisodes, rate, avgRenderFps };
}

function matchesVariantFilter(task, filterValue) {
  if (!filterValue) return true;
  const v = (task.variant ?? "").toLowerCase();
  const id = (task.id ?? "").toLowerCase();
  if (filterValue === "distractors") return v.includes("with distractors");
  if (filterValue === "clean") return v.includes("no distractors");
  if (filterValue === "held") return v.includes("held") || id.includes("_held");
  if (filterValue === "push_t") return task.study === "push_t";
  return true;
}

let dataset;
let allFolders = [];
let selectedCategory = "all";
let selectedView = "explorer";
let selectedTask;
let selectedAttempt;
let selectedTab = "recordings";
let expandedFolders = new Set();
let heroFeatureTask = null;
let stopPlayback = () => {};
let playbackLoop = false;

function buildFolders(tasks) {
  const map = new Map();
  for (const task of tasks) {
    const key = folderKey(task);
    if (!map.has(key)) {
      map.set(key, {
        family: key,
        categoryId: getCategoryId(task),
        title: task.title,
        instruction: task.instruction,
        robot: task.robot,
        study: task.study,
        tasks: [],
      });
    }
    map.get(key).tasks.push(task);
  }
  const folders = [];
  for (const folder of map.values()) {
    folder.tasks.sort((a, b) => a.id.localeCompare(b.id));
    folder.stats = aggregateFolderStats(folder.tasks);
    folder.poster = bestPosterForTasks(folder.tasks);
    folder.slug = folderLabel(folder.family, folder.tasks);
    folders.push(folder);
  }
  return folders;
}

function tile(amount, label, sub = "") {
  return `<div class="overview-tile"><div class="amount">${escape(amount)}</div><div class="tile-label">${escape(label)}</div>${sub ? `<div class="tile-sub">${escape(sub)}</div>` : ""}</div>`;
}

function showSummary() {
  const { study, tasks } = dataset;
  const folderCount = allFolders.length;
  const activeCatCount = new Set(allFolders.map((f) => f.categoryId)).size;
  const totalMedia = (study.mediaEpisodes ?? 0) + (study.supplemental?.mediaEpisodes ?? 0);
  const totalTrials = (study.completed ?? 0) + (study.supplemental?.completed ?? 0);
  const totalAccepted = (study.accepted ?? 0) + (study.supplemental?.accepted ?? 0);

  byId("overview-grid").innerHTML = [
    tile(`${num(folderCount)} folders`, "Grouped task families", `${num(tasks.length)} YAML presets · ${num(activeCatCount)} categories`),
    tile(`${num(study.completed)} / ${num(study.expected)}`, "SimBox trials complete", study.supplemental ? `+ ${num(study.supplemental.completed)} Push-T trials` : ""),
    tile(percentage(study.successRate), "SimBox goal success", `${num(totalAccepted)} / ${num(totalTrials)} total accepted`),
    tile(num(totalMedia), "Multi-camera videos", `${metric(study.renderFps, "fps")} render · H.264 synced`),
  ].join("");

  const chips = [
    study.gpuCount ? `${study.gpuCount}× ${study.gpu.replace("NVIDIA GeForce ", "")}` : study.gpu,
    `${num(folderCount)} Task Folders`,
    `${num(tasks.length)} Presets`,
    "Head + Dual Wrist Views",
  ].filter(Boolean);
  byId("hero-chips").innerHTML = chips.map((c) => `<span class="hero-chip">${escape(c)}</span>`).join("");

  const parts = [
    study.gpuCount ? `${study.gpuCount} × ${study.gpu}` : study.gpu,
    study.nodes ? `${study.nodes} nodes` : "",
    Array.isArray(study.seeds) ? `SimBox seeds ${study.seeds.join(", ")}` : "",
    Number.isFinite(study.primaryWallSeconds) ? `${minutes(study.primaryWallSeconds)} initial SimBox run` : "",
    Number.isFinite(study.wallSeconds) ? `${minutes(study.wallSeconds)} with infrastructure reruns` : "",
    study.revision ? `engine ${study.revision.slice(0, 8)}` : "",
  ].filter(Boolean);
  const extra = study.supplemental;
  if (extra) parts.push(`Push-T replay ${num(extra.accepted)} / ${num(extra.completed)} passed, ${num(extra.skipped)} quota skips`);
  byId("run-summary").textContent = parts.join("  /  ");
  byId("method-study").textContent = parts.join(" · ");

  const example = tasks.flatMap((task) => (task.attempts ?? [])
    .filter((attempt) => attempt.status === "accepted" && safeMedia(attempt.poster) && (attempt.videos?.length ?? 0) >= 2)
    .map((attempt) => ({ task, attempt }))).find(({ task }) => /press_button|fasten_screws|pour_liquid|push/.test(task.id))
    ?? tasks.flatMap((task) => (task.attempts ?? [])
      .filter((attempt) => attempt.status === "accepted" && safeMedia(attempt.poster))
      .map((attempt) => ({ task, attempt })))[0];
  if (example) {
    heroFeatureTask = example.task;
    const image = byId("hero-image");
    image.src = safeMedia(example.attempt.poster);
    image.alt = `Head-camera frame from ${example.task.title}`;
    byId("hero-caption").innerHTML = `<span class="view-pin"></span> HEAD CAMERA <span class="slash">/</span> ${escape(example.task.title.toUpperCase())}`;
    const btn = byId("hero-inspect");
    btn.hidden = false;
    btn.onclick = () => {
      selectedCategory = "all";
      renderCategoryBar();
      setView("explorer");
      selectTask(example.task, attemptKey(example.attempt));
      byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }
}

function activeCategoriesList() {
  const presentIds = new Set(allFolders.map((f) => f.categoryId));
  const list = CATEGORIES.filter((c) => presentIds.has(c.id));
  if (presentIds.has("other")) list.push(getCategoryMeta("other"));
  return list;
}

function renderCategoryBar() {
  const bar = byId("category-bar");
  const cats = activeCategoriesList();
  const totalStats = aggregateFolderStats(dataset.tasks);

  const items = [
    {
      id: "all",
      title: "All Categories",
      folders: allFolders.length,
      presets: dataset.tasks.length,
      rate: totalStats.rate,
    },
    ...cats.map((cat) => {
      const catFolders = allFolders.filter((f) => f.categoryId === cat.id);
      const catTasks = catFolders.flatMap((f) => f.tasks);
      const stats = aggregateFolderStats(catTasks);
      return {
        id: cat.id,
        title: cat.title,
        folders: catFolders.length,
        presets: catTasks.length,
        rate: stats.rate,
      };
    }),
  ];

  bar.innerHTML = items.map((item) => {
    const pct = Number.isFinite(item.rate) ? Math.max(0, Math.min(100, item.rate)) : 0;
    const isSelected = selectedCategory === item.id;
    return `<button type="button" class="cat-card" role="tab" aria-selected="${isSelected}" data-category="${escape(item.id)}">
      <div class="cat-top">
        <span class="cat-icon">${ICONS[item.id] ?? ICONS.other}</span>
        <span class="cat-rate">${escape(percentage(item.rate))}</span>
      </div>
      <div class="cat-title">${escape(item.title)}</div>
      <div class="cat-meta">${num(item.folders)} ${item.folders === 1 ? "folder" : "folders"} · ${num(item.presets)} ${item.presets === 1 ? "preset" : "presets"}</div>
      <div class="cat-bar-track" aria-hidden="true"><div class="cat-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </button>`;
  }).join("");

  bar.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCategory = btn.dataset.category;
      renderCategoryBar();
      updateCatalogHeading();
      const visible = filteredFolders();
      const visibleTasks = visible.flatMap((f) => f.tasks);
      if (visibleTasks.length && !visibleTasks.includes(selectedTask)) {
        selectTask(visibleTasks[0]);
        if (selectedView === "gallery") renderGallery();
      } else {
        renderTaskList();
        if (selectedView === "gallery") renderGallery();
        setAddress();
      }
    });
  });

  updateCatalogHeading();
}

function updateCatalogHeading() {
  if (selectedCategory === "all") {
    byId("catalog-eyebrow").textContent = "ALL CATEGORIES";
    byId("catalog-title").textContent = "Explore the task folders";
  } else {
    const meta = getCategoryMeta(selectedCategory);
    byId("catalog-eyebrow").textContent = `CATEGORY · ${meta.title.toUpperCase()}`;
    byId("catalog-title").textContent = meta.title;
  }
}

function filteredFolders() {
  const queryText = (selectedView === "gallery" ? byId("gallery-query").value : byId("query").value)
    .toLowerCase().trim();
  const words = queryText.split(/\s+/).filter(Boolean);
  const variantFilter = byId("distractor-filter").value;
  const onlyFailures = byId("only-failures").checked;
  const sort = byId("sort").value;

  const matched = [];
  for (const folder of allFolders) {
    if (selectedCategory !== "all" && folder.categoryId !== selectedCategory) continue;
    const catMeta = getCategoryMeta(folder.categoryId);
    const matchingTasks = folder.tasks.filter((task) => {
      if (!matchesVariantFilter(task, variantFilter)) return false;
      if (onlyFailures && !(task.stats.failed > 0)) return false;
      if (!words.length) return true;
      const haystack = [
        task.id, task.title, task.family, task.variant, task.source,
        task.instruction, task.robot, catMeta.title,
      ].join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
    if (!matchingTasks.length) continue;
    matched.push({
      ...folder,
      tasks: matchingTasks,
      stats: aggregateFolderStats(matchingTasks),
      poster: bestPosterForTasks(matchingTasks) || folder.poster,
    });
  }

  const catOrder = new Map(activeCategoriesList().map((c, idx) => [c.id, idx]));
  const familyOrder = (a, b) =>
    (catOrder.get(a.categoryId) ?? 99) - (catOrder.get(b.categoryId) ?? 99)
    || a.title.localeCompare(b.title)
    || a.family.localeCompare(b.family);

  const score = (folder) => ({
    passing: folder.stats.rate ?? -1,
    failure: folder.stats.failed ?? -1,
    speed: folder.stats.avgRenderFps ?? -1,
  })[sort];

  return matched.sort(sort === "category" ? familyOrder : (a, b) => score(b) - score(a) || familyOrder(a, b));
}

function renderTaskList() {
  const list = byId("task-list");
  const folders = filteredFolders();
  const totalPresetCount = folders.reduce((sum, f) => sum + f.tasks.length, 0);
  byId("filter-count").textContent = `${folders.length} folders · ${totalPresetCount} presets`;
  list.replaceChildren();

  if (!folders.length) {
    list.innerHTML = '<p class="empty" style="margin:12px">No task folders match these filters.</p>';
    return;
  }

  const sort = byId("sort").value;
  const showCategoryHeaders = sort === "category" && selectedCategory === "all";
  const fragment = document.createDocumentFragment();
  let lastCategoryId = null;

  for (const folder of folders) {
    if (showCategoryHeaders && folder.categoryId !== lastCategoryId) {
      lastCategoryId = folder.categoryId;
      const catMeta = getCategoryMeta(folder.categoryId);
      const countInCat = folders.filter((f) => f.categoryId === folder.categoryId).length;
      const head = document.createElement("div");
      head.className = "rail-category-head";
      head.innerHTML = `<span>${escape(catMeta.title)}</span><span class="rail-category-count">${num(countInCat)}</span>`;
      fragment.append(head);
    }

    const hasMultiple = folder.tasks.length > 1;
    const isActiveFolder = selectedTask && folder.family === folderKey(selectedTask);
    const isOpen = hasMultiple && expandedFolders.has(folder.family);

    const group = document.createElement("div");
    group.className = `folder-group${isActiveFolder ? " is-active" : ""}${isOpen ? " is-open" : ""}`;

    const row = document.createElement("div");
    row.className = "folder-row";

    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "folder-main";
    const thumbHtml = folder.poster
      ? `<img class="folder-thumb" src="${escape(folder.poster)}" alt="" loading="lazy" width="48" height="36">`
      : `<span class="folder-thumb-placeholder">X5</span>`;
    const rate = folder.stats.rate;
    const tier = rateTier(rate);
    const variantLabel = hasMultiple ? `${folder.tasks.length} presets` : (folder.tasks[0].variant || "1 preset");
    mainBtn.innerHTML = `${thumbHtml}
      <span class="folder-info">
        <span class="folder-title">${escape(folder.title)}</span>
        <span class="folder-sub">${escape(folder.slug)}</span>
      </span>
      <span class="folder-badge-col">
        <span class="rate-pill ${tier}">${escape(percentage(rate))}</span>
        <span class="variant-count">${escape(variantLabel)}</span>
      </span>`;
    mainBtn.addEventListener("click", () => {
      if (hasMultiple) expandedFolders.add(folder.family);
      const target = isActiveFolder ? selectedTask : folder.tasks[0];
      selectTask(target);
      if (matchMedia("(max-width: 820px)").matches) byId("task-detail").scrollIntoView({ behavior: "smooth", block: "start" });
      byId("task-heading")?.focus({ preventScroll: true });
    });
    row.append(mainBtn);

    if (hasMultiple) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "folder-toggle";
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
      toggleBtn.setAttribute("aria-label", `${isOpen ? "Collapse" : "Expand"} ${folder.title} variants`);
      toggleBtn.innerHTML = ICONS.chevron;
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (group.classList.contains("is-open")) {
          expandedFolders.delete(folder.family);
          group.classList.remove("is-open");
          toggleBtn.setAttribute("aria-expanded", "false");
        } else {
          expandedFolders.add(folder.family);
          group.classList.add("is-open");
          toggleBtn.setAttribute("aria-expanded", "true");
        }
      });
      row.append(toggleBtn);
    }

    group.append(row);

    if (hasMultiple) {
      const variantsEl = document.createElement("div");
      variantsEl.className = "folder-variants";
      for (const task of folder.tasks) {
        const vBtn = document.createElement("button");
        vBtn.type = "button";
        vBtn.className = "variant-item";
        vBtn.setAttribute("aria-current", String(task === selectedTask));
        const r = taskRate(task);
        const shortVariant = task.variant || yamlName(task);
        vBtn.innerHTML = `<span class="variant-item-label">${escape(shortVariant)}</span>
          <span class="variant-item-stat">${escape(percentage(r))} · ${num(task.stats.accepted)}/${num(task.stats.completed)}</span>`;
        vBtn.addEventListener("click", () => {
          expandedFolders.add(folder.family);
          selectTask(task);
          if (matchMedia("(max-width: 820px)").matches) byId("task-detail").scrollIntoView({ behavior: "smooth", block: "start" });
          byId("task-heading")?.focus({ preventScroll: true });
        });
        variantsEl.append(vBtn);
      }
      group.append(variantsEl);
    }

    fragment.append(group);
  }

  list.append(fragment);
}

function renderGallery() {
  const container = byId("gallery-grid");
  const folders = filteredFolders();
  const totalPresets = folders.reduce((s, f) => s + f.tasks.length, 0);
  byId("gallery-count").textContent = `${folders.length} task folders · ${totalPresets} YAML presets`;

  if (!folders.length) {
    container.innerHTML = '<p class="empty">No task folders match these filters.</p>';
    return;
  }

  const byCat = new Map();
  for (const folder of folders) {
    if (!byCat.has(folder.categoryId)) byCat.set(folder.categoryId, []);
    byCat.get(folder.categoryId).push(folder);
  }

  const sections = [];
  for (const [catId, catFolders] of byCat.entries()) {
    const meta = getCategoryMeta(catId);
    const catTasks = catFolders.flatMap((f) => f.tasks);
    const catStats = aggregateFolderStats(catTasks);
    const cardsHtml = catFolders.map((folder) => {
      const s = folder.stats;
      const tier = rateTier(s.rate);
      const denom = s.expected || 1;
      const passW = Math.max(0, Math.min(100, (100 * s.accepted) / denom));
      const failW = Math.max(0, Math.min(100, (100 * s.failed) / denom));
      const skipW = Math.max(0, Math.min(100, (100 * s.skipped) / denom));
      const variantChips = folder.tasks.map((t) => {
        const r = taskRate(t);
        return `<button type="button" class="card-variant-chip" data-open-task="${escape(t.id)}">${escape(t.variant || yamlName(t))} <span>${escape(percentage(r))}</span></button>`;
      }).join("");
      const primaryId = folder.tasks[0].id;
      return `<article class="demo-card">
        <div class="demo-card-media" data-open-task="${escape(primaryId)}" role="button" tabindex="0" aria-label="Open ${escape(folder.title)} in explorer">
          ${folder.poster ? `<img src="${escape(folder.poster)}" alt="${escape(folder.title)}" loading="lazy" width="480" height="300">` : ""}
          <div class="demo-card-overlays">
            <div class="demo-card-top-badges">
              <span class="card-glass-badge">${escape(folder.study === "push_t" ? "Push-T Replay" : folder.robot || "Dual ARX X5")}</span>
              <span class="rate-pill ${tier}">${escape(percentage(s.rate))}</span>
            </div>
            <div class="demo-card-bottom-badges">
              <span class="card-glass-badge">${num(s.mediaEpisodes)} videos · ${num(folder.tasks.length)} ${folder.tasks.length === 1 ? "preset" : "presets"}</span>
            </div>
          </div>
        </div>
        <div class="demo-card-body">
          <button type="button" class="demo-card-title-btn" data-open-task="${escape(primaryId)}">
            <span class="demo-card-title">${escape(folder.title)}</span>
            <span class="demo-card-slug">${escape(folder.slug)}</span>
          </button>
          <p class="demo-card-desc">${escape(folder.instruction || "Inspect recordings, goal outcomes, and YAML configuration.")}</p>
          <div class="demo-card-bar">
            <div class="outcome-bar" aria-hidden="true">
              <span class="pass" style="width:${passW}%"></span>
              <span class="fail" style="width:${failW}%"></span>
              <span class="skipped" style="width:${skipW}%"></span>
            </div>
            <span>${num(s.accepted)}/${num(s.completed)} passed</span>
          </div>
          <div class="demo-card-variants">${variantChips}</div>
        </div>
      </article>`;
    }).join("");

    sections.push(`<section class="gallery-category-section">
      <div class="gallery-cat-header">
        <div class="gallery-cat-left">
          <span class="cat-icon">${ICONS[catId] ?? ICONS.other}</span>
          <div>
            <h3>${escape(meta.title)}</h3>
            <p class="gallery-cat-desc">${escape(meta.description)}</p>
          </div>
        </div>
        <span class="gallery-cat-stats">${num(catFolders.length)} folders · ${num(catTasks.length)} presets · ${escape(percentage(catStats.rate))} pass</span>
      </div>
      <div class="gallery-cards">${cardsHtml}</div>
    </section>`);
  }

  container.innerHTML = sections.join("");
  container.querySelectorAll("[data-open-task]").forEach((el) => {
    const open = () => {
      const task = dataset.tasks.find((t) => t.id === el.dataset.openTask);
      if (!task) return;
      expandedFolders.add(folderKey(task));
      setView("explorer");
      selectTask(task);
      byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
      byId("task-heading")?.focus({ preventScroll: true });
    };
    el.addEventListener("click", open);
    if (el.getAttribute("role") === "button") {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    }
  });
}

function setView(view) {
  selectedView = view === "gallery" ? "gallery" : "explorer";
  const isGallery = selectedView === "gallery";
  byId("explorer-view").hidden = isGallery;
  byId("gallery-view").hidden = !isGallery;
  byId("view-explorer").setAttribute("aria-pressed", String(!isGallery));
  byId("view-gallery").setAttribute("aria-pressed", String(isGallery));
  if (isGallery) {
    stopPlayback();
    byId("gallery-query").value = byId("query").value;
    renderGallery();
  } else {
    byId("query").value = byId("gallery-query").value;
    renderTaskList();
  }
  setAddress();
}

function setAddress() {
  if (!selectedTask) return;
  const url = new URL(location.href);
  url.searchParams.set("task", selectedTask.id);
  if (selectedAttempt) url.searchParams.set("seed", attemptKey(selectedAttempt));
  else url.searchParams.delete("seed");
  if (selectedCategory && selectedCategory !== "all") url.searchParams.set("category", selectedCategory);
  else url.searchParams.delete("category");
  if (selectedView === "gallery") url.searchParams.set("view", "gallery");
  else url.searchParams.delete("view");
  if (location.protocol !== "file:") history.replaceState(null, "", url.href);
}

function firstAttempt(task, seed) {
  const attempts = task.attempts ?? [];
  if (seed !== null && seed !== undefined) {
    const requested = attempts.find((attempt) => String(attemptKey(attempt)) === String(seed));
    if (requested) return requested;
  }
  if (byId("only-failures").checked) {
    const failed = attempts.find((attempt) => statusClass(attempt.status) === "fail" && attempt.videos?.length)
      ?? attempts.find((attempt) => statusClass(attempt.status) === "fail");
    if (failed) return failed;
  }
  return attempts.find((attempt) => attempt.status === "accepted" && attempt.videos?.length)
    ?? attempts.find((attempt) => attempt.videos?.length)
    ?? attempts.find((attempt) => !["missing", "pending", "skipped"].includes(attempt.status))
    ?? attempts[0];
}

function selectTask(task, seed) {
  selectedTask = task;
  selectedAttempt = firstAttempt(task, seed);
  selectedTab = "recordings";
  expandedFolders.add(folderKey(task));
  setAddress();
  renderTaskList();
  renderTask();
}

function detailCard(title, values) {
  const list = values.filter(Boolean);
  return `<section class="info"><h3>${escape(title)}</h3>${list.length ? `<ul>${list.map((value) => `<li>${escape(value)}</li>`).join("")}</ul>` : "<p>None listed</p>"}</section>`;
}

function displayValue(value) {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

function yamlDetails(task) {
  const cameras = (task.views ?? []).map((view) => `${view.label || view.key}${view.width && view.height ? ` · ${view.width} × ${view.height}` : ""}`);
  const sequence = (task.skills ?? []).map((skill) => `${skill.robot} / ${skill.arm} · ${skill.name}${skill.objects?.length ? ` (${skill.objects.join(", ")})` : ""}`);
  const objects = (task.objects ?? []).map((obj) => [obj.name, obj.type, obj.pool && `pool ${obj.pool}`, obj.scale && `scale ${displayValue(obj.scale)}`].filter(Boolean).join(" · "));
  const goals = (task.goals ?? []).map((goal) => [goal.type, goal.objects?.join(", "),
    goal.thresholds && Object.entries(goal.thresholds).map(([key, value]) => `${key} = ${displayValue(value)}`).join(", ")].filter(Boolean).join(" · "));
  const settings = JSON.stringify(task.settings ?? {}, null, 2);
  const optics = (task.views ?? []).map((view) => ({
    camera: view.label || view.key,
    ...view.settings,
    ...view.optics,
  }));
  const parameters = (task.skills ?? []).map((skill) => ({
    group: skill.group, robot: skill.robot, arm: skill.arm, skill: skill.name, ...skill.settings,
  }));
  const authored = { objects: task.objects ?? [], cameras: optics, skills: parameters, goals: task.goals ?? [] };
  return `<h3>Preset contents</h3><div class="info-grid">${detailCard("Robot and cameras", [task.robot, ...cameras])}${detailCard("Skill sequence", sequence)}${detailCard("Scene object roles", objects)}${detailCard("Goal conditions", goals)}</div>
  <details class="details-toggle"><summary>Scene and runtime settings</summary><pre class="yaml-summary">${escape(settings)}</pre></details>
  <details class="details-toggle"><summary>Object, camera, skill, and goal parameters</summary><pre class="yaml-summary">${escape(JSON.stringify(authored, null, 2))}</pre></details>
  <div class="info" style="margin-top:12px"><h3>Preset identity</h3><p>${escape(task.source)}</p><p class="source-path">SHA-256 ${escape(task.sha256 || "unavailable")}</p></div>`;
}

function countsPanel(task) {
  const attempts = task.attempts ?? [];
  const stats = task.stats;
  const outcomes = Object.entries(task.stats.statuses ?? {}).filter(([, count]) => count > 0)
    .map(([status, count]) => `${attemptLabel(task, status)} ${num(count)}`);
  const roll = attempts.flatMap((item) => Object.values(item.wristRoll ?? {})).reduce(
    (totals, value) => [totals[0] + value.inverted_frames, totals[1] + value.measurable_frames], [0, 0]);
  const measurements = [
    ["Median scene setup", metric(stats.sceneSetupMedian, "s")],
    ["Median rollout", metric(stats.rolloutMedian, "s")],
    ["Median render time", metric(stats.renderMedian, "s")],
    ["Capture throughput", metric(stats.recordingFps, "fps")],
  ];
  if (roll[1] > 0) measurements.push(["Inverted wrist frames", `${num(roll[0])} / ${num(roll[1])}`]);
  const rows = attempts.map((item) => `
    <tr><td><button data-seed="${escape(attemptKey(item))}" type="button" aria-label="View ${sampleLabel(task).toLowerCase()} ${escape(attemptKey(item))} recording">${escape(seedLabel(attemptKey(item)))}</button></td>
    <td><span class="status ${statusClass(item.status)}">${escape(attemptLabel(task, item.status))}</span></td>
    <td class="prompt-cell">${escape(item.instruction || task.instruction || "–")}</td>
    <td>${metric(item.seconds, "s")}</td><td>${metric(item.renderSeconds, "s")}</td><td>${num(item.frames)}</td>
    <td>${escape([item.stage, item.reason].filter(Boolean).join(" · ") || "–")}</td></tr>`).join("");
  return `<h3>All attempts</h3><p class="detail-line" style="margin:8px 0 11px;color:var(--muted)">${escape(outcomes.join(" · "))}</p>
    <dl class="attempt-meta">${measurements.map(([key, value]) => `<div class="info"><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>${sampleLabel(task)}</th><th>Outcome</th><th>Prompt</th><th>Total wall</th><th>Render time</th><th>Frames</th><th>Stage and reason</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function goalEvidence(goals) {
  if (!Array.isArray(goals) || !goals.length) return "";
  return `<details class="details-toggle"><summary>Measured goal checks (${goals.length})</summary>
  <div class="info-grid">${goals.map((goal) => {
    const name = [readable(goal.type), goal.status && statusLabel(goal.status)].filter(Boolean).join(" · ");
    const measurements = (goal.measurements ?? []).filter((value) => value && typeof value === "object");
    const entries = measurements.flatMap((measurement) => [
      measurement.object && readable(measurement.object),
      ...Object.entries(measurement).filter(([key]) => key !== "object").map(([key, value]) => {
        const amount = typeof value !== "number" ? displayValue(value)
          : key.endsWith("_m") ? metric(value * 1000, "mm", 2) : num(value, 3);
        const label = readable(key.endsWith("_m") ? key.slice(0, -2) : key);
        return `${label}  ${amount}`;
      }),
    ]);
    return detailCard(name, [...entries, goal.reason]);
  }).join("")}</div></details>`;
}

function attemptMarkup() {
  const attempts = selectedTask.attempts ?? [];
  if (!selectedAttempt) return '<p class="empty">No trials are listed for this preset.</p>';
  const match = selectedAttempt;
  const videos = (match.videos ?? []).filter((view) => safeMedia(view.src));
  const cameras = videos.map((view, index) => {
    const poster = safeMedia(view.poster ?? (index === 0 ? match.poster : null));
    return `<figure class="view ${index === 0 ? "primary-view" : ""}">
    <video aria-label="${escape(view.label)}" preload="metadata" src="${escape(view.src)}" ${poster ? `poster="${escape(poster)}"` : ""} muted playsinline></video>
    <figcaption>${escape(view.label)}</figcaption></figure>`;
  }).join("");
  const player = videos.length ? `<div class="player"><div class="camera-grid ${videos.length === 1 ? "single" : ""}">${cameras}</div>
    <div class="transport">
      <button id="play" class="transport-btn" type="button" aria-label="Play synchronized cameras">▶ Play</button>
      <input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Playback position">
      <output id="clock">0:00 / 0:00</output>
      <div class="speed-group" role="group" aria-label="Playback speed">
        <button type="button" class="speed-btn" data-speed="0.5" aria-pressed="false">0.5×</button>
        <button type="button" class="speed-btn" data-speed="1" aria-pressed="true">1×</button>
        <button type="button" class="speed-btn" data-speed="2" aria-pressed="false">2×</button>
      </div>
      <button id="loop-btn" class="transport-btn${playbackLoop ? " is-active" : ""}" type="button" aria-pressed="${playbackLoop}" title="Toggle loop">Loop</button>
    </div></div>` : '<p class="empty">This attempt has no recorded video.</p>';

  const rolls = Object.entries(match.wristRoll ?? {}).map(([key, value]) =>
    `${readable(key.replace(/^x5_/, ""))} ${num(value.inverted_frames)} / ${num(value.measurable_frames)} inverted`);
  const assets = Array.isArray(match.assets) ? match.assets.map((asset) => asset && typeof asset === "object"
    ? [readable(asset.role), asset.label].filter(Boolean).join(" · ") : displayValue(asset)).join("\n")
    : Object.values(match.assets ?? {}).map(displayValue).join(", ");
  const fail = attempts.find((item) => statusClass(item.status) === "fail" && item.videos?.length)
    ?? attempts.find((item) => statusClass(item.status) === "fail");
  const pass = attempts.find((item) => item.status === "accepted" && item.videos?.length);
  const alternate = statusClass(match.status) === "fail" ? pass : fail;
  const readouts = [
    ["Captured frames", Number.isFinite(match.frames) ? `${num(match.frames)} at ${metric(match.fps, "fps", 0)}` : "–"],
    ["Attempt wall time", metric(match.seconds, "s")],
    ["Rollout wall time", metric(match.rolloutSeconds, "s")],
    ["Render time", metric(match.renderSeconds, "s")],
    ...rolls.map((roll) => ["Wrist roll", roll]),
  ];
  if (Number.isFinite(match.sceneSetupSeconds)) readouts.push(["Scene setup", metric(match.sceneSetupSeconds, "s")]);
  if (Number.isFinite(match.recordingSeconds)) readouts.push(["Video finalization", metric(match.recordingSeconds, "s")]);
  if (Number.isFinite(match.frames) && match.rolloutSeconds > 0) readouts.push(["Capture throughput", metric(match.frames / match.rolloutSeconds, "fps")]);
  if (Number.isFinite(match.officialScore)) readouts.push(["Native reward", percentage(match.officialScore)]);
  if (Array.isArray(match.sampledBlockPose) && match.sampledBlockPose.length === 3) {
    const [x, y, yaw] = match.sampledBlockPose;
    readouts.push(["Sampled block pose", `X ${metric(x, "m", 3)} · Y ${metric(y, "m", 3)} · yaw ${metric(yaw, "°")}`]);
  }
  const prompt = match.instruction || selectedTask.instruction;
  if (assets) readouts.push(["Selected assets", assets]);
  if (match.detailedInstruction && match.detailedInstruction !== prompt) readouts.push(["Detailed prompt", match.detailedInstruction]);
  const retries = (match.infrastructureRetries ?? []).map((retry) =>
    [statusLabel(retry.status), retry.stage && readable(retry.stage), retry.reason].filter(Boolean).join(" · "));
  const replayHistory = retries.length > 0
    ? `<details class="details-toggle"><summary>Earlier infrastructure attempts (${retries.length})</summary>${detailCard("Retry history", retries)}</details>`
    : "";

  return `<div class="seed-strip"><span class="key">${sampleLabel(selectedTask).toUpperCase()}</span>${attempts.map((item) => `<button type="button" class="seed ${statusClass(item.status)}" data-seed="${escape(attemptKey(item))}" aria-pressed="${item === match}" aria-label="${sampleLabel(selectedTask)} ${escape(attemptKey(item))} · ${escape(attemptLabel(selectedTask, item.status))}">${escape(seedLabel(attemptKey(item)))}</button>`).join("")}
  ${alternate ? `<button class="seed-shortcut" type="button" data-seed="${escape(attemptKey(alternate))}">${statusClass(match.status) === "fail" ? "Jump to a success" : "Jump to a failure"}</button>` : ""}</div>
  <div class="attempt-head"><span class="status ${statusClass(match.status)}">${escape(attemptLabel(selectedTask, match.status))}</span>${match.stage ? `<span class="key">${escape(readable(match.stage))}</span>` : ""}</div>
  ${prompt ? `<div class="attempt-prompt"><span class="key">PROMPT</span><p>${escape(prompt)}</p></div>` : ""}
  ${match.reason ? `<p class="reason">${escape(match.reason)}</p>` : ""}${player}
  <dl class="attempt-meta">${readouts.map(([key, value]) => `<div class="info"><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>${goalEvidence(match.goals)}${replayHistory}`;
}

function timeLabel(value) {
  if (!Number.isFinite(value)) return "0:00";
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function bindPlayer(panel) {
  const streams = [...panel.querySelectorAll("video")];
  const main = streams[0];
  if (!main) return;
  const play = byId("play");
  const scrub = byId("scrub");
  const clock = byId("clock");
  const loopBtn = byId("loop-btn");
  const speedBtns = [...panel.querySelectorAll(".speed-btn")];

  const stop = () => streams.forEach((stream) => stream.pause());
  const duration = () => {
    const lengths = streams.map((stream) => stream.duration).filter(Number.isFinite);
    return lengths.length ? Math.min(...lengths) : 0;
  };
  function align(position) {
    for (const stream of streams) {
      if (stream.readyState && Math.abs(stream.currentTime - position) > 0.045) {
        stream.currentTime = Math.min(position, stream.duration || position);
      }
    }
  }
  function refresh() {
    const end = duration();
    scrub.value = end ? String(Math.round((1000 * main.currentTime) / end)) : "0";
    clock.value = `${timeLabel(main.currentTime)} / ${timeLabel(end)}`;
    play.textContent = main.paused ? "▶ Play" : "Ⅱ Pause";
    play.setAttribute("aria-label", main.paused ? "Play synchronized cameras" : "Pause synchronized cameras");
    for (const stream of streams.slice(1)) {
      if (stream.readyState > 1 && Math.abs(stream.currentTime - main.currentTime) > 0.16) stream.currentTime = main.currentTime;
    }
    if (!main.paused && end && end - main.currentTime < 0.015) {
      if (playbackLoop) {
        align(0);
        streams.forEach((s) => s.play().catch(() => {}));
      } else {
        stop();
      }
    }
  }
  async function togglePlay() {
    if (!main.paused) {
      stop();
      return;
    }
    if (duration() && duration() - main.currentTime < 0.04) align(0);
    align(main.currentTime);
    const playback = await Promise.allSettled(streams.map((stream) => stream.play()));
    if (playback[0]?.status === "rejected") {
      stop();
      clock.value = "Unavailable";
    }
  }

  play.addEventListener("click", togglePlay);
  panel.querySelectorAll(".view").forEach((view) => view.addEventListener("click", togglePlay));
  scrub.addEventListener("input", () => {
    align((Number(scrub.value) * duration()) / 1000);
    refresh();
  });
  speedBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const rate = Number(btn.dataset.speed);
      streams.forEach((stream) => { stream.playbackRate = rate; });
      speedBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    });
  });
  loopBtn.addEventListener("click", () => {
    playbackLoop = !playbackLoop;
    loopBtn.classList.toggle("is-active", playbackLoop);
    loopBtn.setAttribute("aria-pressed", String(playbackLoop));
  });
  main.addEventListener("timeupdate", refresh);
  main.addEventListener("play", refresh);
  main.addEventListener("pause", refresh);
  main.addEventListener("ended", () => {
    if (playbackLoop) {
      align(0);
      streams.forEach((s) => s.play().catch(() => {}));
    } else {
      stop();
    }
  });
  streams.forEach((stream) => stream.addEventListener("loadedmetadata", refresh));
  stopPlayback = stop;
}

function distribution(stats) {
  const classes = [["accepted", "pass", "accepted"], ["failed", "fail", "failed"],
    ["skipped", "skipped", "quota skips"], ["missing", "missing", "missing"]];
  const denominator = stats.expected || 1;
  const chunks = classes.filter(([key]) => stats[key] > 0);
  const label = chunks.map(([key, , title]) => `${num(stats[key])} ${title}`).join(" · ");
  return `<div class="distribution"><div class="outcome-bar" role="img" aria-label="${escape(label)}">${chunks.map(([key, kind]) =>
    `<span class="${kind}" style="width:${Math.max(0, Math.min(100, (100 * stats[key]) / denominator))}%"></span>`).join("")}</div>
    <p>${escape(label)}${stats.mediaEpisodes ? ` · ${num(stats.mediaEpisodes)} recordings` : ""}</p></div>`;
}

function renderTask() {
  stopPlayback();
  stopPlayback = () => {};
  const task = selectedTask;
  if (!task) return;

  const stats = task.stats;
  const executionOnly = stats.metric === "execution_completion";
  const label = executionOnly ? "Execution completion" : task.study === "push_t" ? "Native reward pass rate" : "Goal success rate";
  const denominator = executionOnly ? stats.executionDenominator : stats.successDenominator;
  const rate = taskRate(task);

  const catId = getCategoryId(task);
  const catMeta = getCategoryMeta(catId);
  const folder = allFolders.find((f) => f.family === folderKey(task));
  const siblings = folder?.tasks ?? [task];

  const variantSwitcherHtml = siblings.length > 1 ? `<div class="variant-switcher">
    <div class="variant-switcher-label">
      <span>Variants in ${escape(folder.slug)}</span>
      <span>${num(siblings.length)} presets in folder</span>
    </div>
    <div class="variant-pills">${siblings.map((sibling) => {
      const r = taskRate(sibling);
      return `<button type="button" class="variant-pill" data-sibling="${escape(sibling.id)}" aria-pressed="${sibling === task}">
        <span>${escape(sibling.variant || yamlName(sibling))}</span>
        <span class="vp-rate">${escape(percentage(r))}</span>
      </button>`;
    }).join("")}</div>
  </div>` : "";

  byId("task-detail").innerHTML =
    `<header class="task-head">
      <div class="task-breadcrumbs">
        <button type="button" class="crumb-cat" id="crumb-cat-btn">${escape(catMeta.title)}</button>
        <span class="crumb-folder">/ ${escape(folder?.slug ?? task.family)}</span>
        ${task.robot ? `<span class="crumb-robot">${escape(task.robot)}</span>` : ""}
      </div>
      <h2 id="task-heading" tabindex="-1">${escape(task.title)}</h2>
      <p class="task-instruction">${escape(task.instruction || "Task details below.")}</p>
      <p class="source-path">${escape(task.source)}</p>
    </header>
    ${variantSwitcherHtml}
    <div class="task-metrics">${[
      tile(percentage(rate), `${label}${Number.isFinite(denominator) ? ` · n=${denominator}` : ""}`),
      tile(`${num(stats.accepted)} / ${num(stats.completed)}`, "Accepted / completed"),
      tile(metric(stats.attemptMedian, "s"), "Median attempt wall"),
      tile(metric(stats.renderFps, "fps"), "Render throughput"),
    ].join("")}</div>
    ${distribution(stats)}
    <div class="tabs" role="tablist" aria-label="Preset information">${[["recordings", "Recordings"], ["yaml", "YAML details"], ["attempts", "All attempts"]]
      .map(([key, title]) => `<button type="button" role="tab" id="tab-${key}" aria-controls="tab-body" data-tab="${key}" aria-selected="${key === selectedTab}">${title}</button>`).join("")}</div>
    <div class="tab-body" role="tabpanel" id="tab-body" aria-labelledby="tab-${selectedTab}"></div>`;

  byId("crumb-cat-btn")?.addEventListener("click", () => {
    selectedCategory = catId;
    renderCategoryBar();
    renderTaskList();
    setAddress();
  });
  byId("task-detail").querySelectorAll("[data-sibling]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = dataset.tasks.find((t) => t.id === btn.dataset.sibling);
      if (target && target !== selectedTask) selectTask(target);
    });
  });
  byId("task-detail").querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    selectedTab = button.dataset.tab;
    byId("task-detail").querySelectorAll("[data-tab]").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    renderTab();
  }));
  renderTab();
}

function renderTab() {
  stopPlayback();
  const panel = byId("tab-body");
  panel.setAttribute("aria-labelledby", `tab-${selectedTab}`);
  panel.innerHTML = selectedTab === "recordings" ? attemptMarkup()
    : selectedTab === "yaml" ? yamlDetails(selectedTask) : countsPanel(selectedTask);
  panel.querySelectorAll("button[data-seed]").forEach((button) => button.addEventListener("click", () => {
    selectedAttempt = selectedTask.attempts.find((item) => String(attemptKey(item)) === button.dataset.seed);
    setAddress();
    if (selectedTab !== "recordings") {
      selectedTab = "recordings";
      renderTask();
    } else renderTab();
    byId("tab-body").querySelector(`button[data-seed="${CSS.escape(button.dataset.seed)}"]`)?.focus({ preventScroll: true });
  }));
  if (selectedTab === "recordings") bindPlayer(panel);
}

async function start() {
  const params = new URLSearchParams(location.search);
  const earlierTasks = ["all", "swap_objects", "press_button", "left_to_right", "right_to_left",
    "pick_left_place_right", "pick_right_place_left"];
  if (earlierTasks.includes(params.get("task")) ||
      ["#gallery", "#regrasp-benchmark", "#grasp-geometry-benchmark"].includes(location.hash)) {
    location.replace(`archive.html${location.search}${location.hash}`);
    return;
  }

  const inline = byId("benchmark-data").textContent.trim();
  if (inline && inline !== "{}") dataset = JSON.parse(inline);
  else {
    const response = await fetch("benchmark.json");
    if (!response.ok) throw new Error("Unable to load benchmark.json");
    dataset = await response.json();
  }

  allFolders = buildFolders(dataset.tasks);
  showSummary();

  const requestedCategory = params.get("category");
  if (requestedCategory && (requestedCategory === "all" || activeCategoriesList().some((c) => c.id === requestedCategory))) {
    selectedCategory = requestedCategory;
  }
  renderCategoryBar();

  const initial = dataset.tasks.find((task) => task.id === params.get("task"))
    ?? dataset.tasks.find((task) => task.id === "dual_x5_press_button")
    ?? dataset.tasks[0];
  if (initial) selectTask(initial, params.get("seed"));
  else byId("task-detail").textContent = "No benchmark presets are available.";

  if (params.get("view") === "gallery") setView("gallery");

  byId("view-explorer").addEventListener("click", () => setView("explorer"));
  byId("view-gallery").addEventListener("click", () => setView("gallery"));
  byId("hero-gallery-btn").addEventListener("click", () => {
    setView("gallery");
    byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  for (const [id, event] of [["query", "input"], ["distractor-filter", "change"], ["sort", "change"], ["only-failures", "change"]]) {
    byId(id).addEventListener(event, () => {
      const folders = filteredFolders();
      const tasks = folders.flatMap((f) => f.tasks);
      if (tasks.length && (!tasks.includes(selectedTask) || id === "only-failures")) {
        selectTask(tasks.includes(selectedTask) ? selectedTask : tasks[0]);
      } else {
        renderTaskList();
      }
    });
  }

  byId("gallery-query").addEventListener("input", () => {
    byId("query").value = byId("gallery-query").value;
    renderGallery();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target?.closest?.("input, textarea, select, button, a, summary, [role='button']")) return;
    if (selectedView !== "explorer" || selectedTab !== "recordings") return;
    if (e.code === "Space" && byId("play")) {
      e.preventDefault();
      byId("play").click();
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && selectedTask?.attempts?.length) {
      const idx = selectedTask.attempts.indexOf(selectedAttempt);
      if (idx < 0) return;
      const nextIdx = e.key === "ArrowRight" ? idx + 1 : idx - 1;
      if (nextIdx >= 0 && nextIdx < selectedTask.attempts.length) {
        selectedAttempt = selectedTask.attempts[nextIdx];
        setAddress();
        renderTab();
      }
    }
  });
}

start().catch(() => {
  byId("task-detail").innerHTML = '<p class="empty">Benchmark data could not be opened. <a href="benchmark.json">Open the dataset JSON</a>.</p>';
});
