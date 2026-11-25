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

let dataset;
let selectedTask;
let selectedAttempt;
let selectedTab = "recordings";
let stopPlayback = () => {};

function tile(amount, label) {
  return `<div class="overview-tile"><div class="amount">${escape(amount)}</div><div class="tile-label">${escape(label)}</div></div>`;
}

function showSummary() {
  const { study, tasks } = dataset;
  byId("overview-grid").innerHTML = [
    tile(num(new Set(tasks.map((task) => task.source)).size), "X5 preset YAMLs"),
    tile(`${num(study.completed)} / ${num(study.expected)}`, "SimBox trials complete"),
    tile(num(study.accepted), "SimBox rollouts accepted"),
    tile(num(study.mediaEpisodes), "SimBox trials with video"),
  ].join("");
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
    .map((attempt) => ({ task, attempt }))).find(({task}) => /push|press|swap/.test(task.id));
  if (example) {
    const image = byId("hero-image");
    image.src = safeMedia(example.attempt.poster);
    image.alt = `Head-camera frame from ${example.task.title}`;
    byId("hero-caption").innerHTML = `<span class="view-pin"></span> HEAD CAMERA <span class="slash">/</span> ${escape(example.task.title.toUpperCase())}`;
  }
}

function filteredTasks() {
  const words = byId("query").value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const family = byId("family").value;
  const onlyFailures = byId("only-failures").checked;
  const sort = byId("sort").value;
  const values = dataset.tasks.filter((task) => {
    const haystack = [task.id, task.title, task.family, task.variant, task.source, task.instruction, task.robot].join(" ").toLowerCase();
    return (!family || task.family === family) && (!onlyFailures || task.stats.failed > 0)
      && words.every((word) => haystack.includes(word));
  });
  const familyOrder = (a, b) => a.family.localeCompare(b.family) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  const score = (task) => ({
    passing: task.stats.successRate ?? task.stats.executionRate ?? -1,
    failure: task.stats.failed ?? -1,
    speed: task.stats.renderFps ?? -1,
  })[sort];
  return values.sort(sort === "family" ? familyOrder : (a, b) => score(b) - score(a) || familyOrder(a, b));
}

function renderTaskList() {
  const list = byId("task-list");
  const visible = filteredTasks();
  byId("filter-count").textContent = `${visible.length} of ${dataset.tasks.length} presets`;
  list.replaceChildren();
  if (!visible.length) {
    list.innerHTML = '<p class="empty">No presets match these filters.</p>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const task of visible) {
    const button = document.createElement("button");
    button.className = "task-entry";
    button.type = "button";
    button.dataset.task = task.id;
    button.setAttribute("aria-current", String(task === selectedTask));
    const rate = task.stats.successRate ?? task.stats.executionRate;
    const label = Number.isFinite(rate) ? `${percentage(rate)} ${task.stats.successRate == null ? "execution" : "success"} · ` : "";
    const isReplay = task.study === "push_t";
    const detail = isReplay ? task.variant : yamlName(task);
    const covered = isReplay ? `${num(task.stats.completed)} trials · ${num(task.stats.skipped)} quota skips`
      : `${num(task.stats.completed)} / ${num(task.stats.expected)} trials`;
    button.innerHTML = `<span class="task-name">${escape(task.title)}</span><span class="task-file">${escape(detail)}</span><span class="count">${escape(label + covered)}</span>`;
    button.addEventListener("click", () => {
      selectTask(task);
      if (matchMedia("(max-width: 740px)").matches) byId("task-detail").scrollIntoView({ block: "start" });
      byId("task-heading").focus({ preventScroll: true });
    });
    fragment.append(button);
  }
  list.append(fragment);
}

function setAddress() {
  const url = new URL(location.href);
  url.searchParams.set("task", selectedTask.id);
  if (selectedAttempt) url.searchParams.set("seed", attemptKey(selectedAttempt));
  else url.searchParams.delete("seed");
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
  setAddress();
  renderTaskList();
  renderTask();
}

function detailCard(title, values) {
  const list = values.filter(Boolean);
  return `<section class="info"><h3>${escape(title)}</h3>${list.length ? `<ul>${list.map((value) => `<li>${escape(value)}</li>`).join("")}</ul>` : '<p>None listed</p>'}</section>`;
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
  <div class="info" style="margin-top:10px"><h3>Preset identity</h3><p>${escape(task.source)}</p><p class="source-path">SHA-256 ${escape(task.sha256 || "unavailable")}</p></div>`;
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
    <td>${metric(item.seconds, "s")}</td><td>${metric(item.renderSeconds, "s")}</td><td>${num(item.frames)}</td>
    <td>${escape([item.stage, item.reason].filter(Boolean).join(" · ") || "–")}</td></tr>`).join("");
  return `<h3>All attempts</h3><p class="detail-line" style="margin:8px 0 11px">${escape(outcomes.join(" · "))}</p>
    <dl class="attempt-meta">${measurements.map(([key, value]) => `<div class="info"><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>${sampleLabel(task)}</th><th>Outcome</th><th>Total wall</th><th>Render time</th><th>Frames</th><th>Stage and reason</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
        const amount = typeof value !== "number" ? displayValue(value) :
          key.endsWith("_m") ? metric(value * 1000, "mm", 2) : num(value, 3);
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
      <button id="play" type="button" aria-label="Play synchronized cameras">▶ Play</button>
      <input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Playback position">
      <output id="clock">0:00</output>
      <select id="speed" aria-label="Playback speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>
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
  if (assets) readouts.push(["Selected assets", assets]);
  if (match.instruction && match.instruction !== selectedTask.instruction) readouts.push(["Resolved instruction", match.instruction]);
  const retries = (match.infrastructureRetries ?? []).map((retry) =>
    [statusLabel(retry.status), retry.stage && readable(retry.stage), retry.reason].filter(Boolean).join(" · "));
  const replayHistory = retries.length > 0
    ? `<details class="details-toggle"><summary>Earlier infrastructure attempts (${retries.length})</summary>${detailCard("Retry history", retries)}</details>`
    : "";
  return `<div class="seed-strip"><span class="key">${sampleLabel(selectedTask).toUpperCase()}</span>${attempts.map((item) => `<button type="button" class="seed ${statusClass(item.status)}" data-seed="${escape(attemptKey(item))}" aria-pressed="${item === match}" aria-label="${sampleLabel(selectedTask)} ${escape(attemptKey(item))} · ${escape(attemptLabel(selectedTask, item.status))}">${escape(seedLabel(attemptKey(item)))}</button>`).join("")}
  ${alternate ? `<button class="seed-shortcut" type="button" data-seed="${escape(attemptKey(alternate))}">${statusClass(match.status) === "fail" ? "Show a success" : "Show a failure"}</button>` : ""}</div>
  <div class="attempt-head"><span class="status ${statusClass(match.status)}">${escape(attemptLabel(selectedTask, match.status))}</span>${match.stage ? `<span class="key">${escape(readable(match.stage))}</span>` : ""}</div>
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
  const speed = byId("speed");
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
    scrub.value = end ? String(Math.round(1000 * main.currentTime / end)) : "0";
    clock.value = `${timeLabel(main.currentTime)} / ${timeLabel(end)}`;
    play.textContent = main.paused ? "▶ Play" : "Ⅱ Pause";
    play.setAttribute("aria-label", main.paused ? "Play synchronized cameras" : "Pause synchronized cameras");
    for (const stream of streams.slice(1)) {
      if (stream.readyState > 1 && Math.abs(stream.currentTime - main.currentTime) > 0.16) stream.currentTime = main.currentTime;
    }
    if (!main.paused && end && end - main.currentTime < 0.012) stop();
  }
  play.addEventListener("click", async () => {
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
  });
  scrub.addEventListener("input", () => {
    align(Number(scrub.value) * duration() / 1000);
    refresh();
  });
  speed.addEventListener("change", () => {
    streams.forEach((stream) => { stream.playbackRate = Number(speed.value); });
  });
  main.addEventListener("timeupdate", refresh);
  main.addEventListener("play", refresh);
  main.addEventListener("pause", refresh);
  main.addEventListener("ended", stop);
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
    `<span class="${kind}" style="width:${Math.max(0, Math.min(100, 100 * stats[key] / denominator))}%"></span>`).join("")}</div>
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
  const rate = stats.successRate ?? stats.executionRate;
  byId("task-detail").innerHTML =
    `<header class="task-head"><p class="eyebrow">${escape([readable(task.family), task.variant].filter(Boolean).join(" / ").toUpperCase())}</p>
    <h2 id="task-heading" tabindex="-1">${escape(task.title)}</h2><p>${escape(task.instruction || "Task details below.")}</p>
    <p class="source-path">${escape(task.source)}</p></header>
    <div class="task-metrics">${[
      tile(percentage(rate), `${label}${Number.isFinite(denominator) ? ` · n=${denominator}` : ""}`),
      tile(`${num(stats.accepted)} / ${num(stats.completed)}`, "Accepted / completed"),
      tile(metric(stats.attemptMedian, "s"), "Median attempt wall"),
      tile(metric(stats.renderFps, "fps"), "Render throughput"),
    ].join("")}</div>
    ${distribution(stats)}<div class="tabs" role="tablist" aria-label="Preset information">${[["recordings", "Recordings"], ["yaml", "YAML details"], ["attempts", "All attempts"]]
      .map(([key, title]) => `<button type="button" role="tab" id="tab-${key}" aria-controls="tab-body" data-tab="${key}" aria-selected="${key === selectedTab}">${title}</button>`).join("")}</div>
    <div class="tab-body" role="tabpanel" id="tab-body" aria-labelledby="tab-${selectedTab}"></div>`;
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
  if (inline) dataset = JSON.parse(inline);
  else {
    const response = await fetch("benchmark.json");
    if (!response.ok) throw new Error("Unable to load benchmark.json");
    dataset = await response.json();
  }
  showSummary();
  const families = [...new Set(dataset.tasks.map((task) => task.family))].sort();
  for (const family of families) {
    const option = new Option(readable(family), family);
    byId("family").append(option);
  }
  const initial = dataset.tasks.find((task) => task.id === params.get("task"))
    ?? dataset.tasks.find((task) => task.id === "dual_x5_press_button")
    ?? dataset.tasks[0];
  if (initial) selectTask(initial, params.get("seed"));
  else byId("task-detail").textContent = "No benchmark presets are available.";
  for (const [id, event] of [["query", "input"], ["family", "change"], ["sort", "change"], ["only-failures", "change"]]) {
    byId(id).addEventListener(event, () => {
      const tasks = filteredTasks();
      if (tasks.length && (!tasks.includes(selectedTask) || id === "only-failures")) {
        selectTask(tasks.includes(selectedTask) ? selectedTask : tasks[0]);
      } else renderTaskList();
    });
  }
}

start().catch(() => {
  byId("task-detail").innerHTML = '<p class="empty">Benchmark data could not be opened. <a href="benchmark.json">Open the dataset JSON</a>.</p>';
});
