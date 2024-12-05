import { fetchManifest, fetchModule, DepMap } from "./moduel-cdn";

function showResult(data: any) {
  const resultEl = document.getElementById("result");
  if (resultEl) {
    resultEl.textContent = JSON.stringify(data, null, 2);
  }
}

async function handleFetchManifest() {
  try {
    const depInput = document.getElementById("depInput") as HTMLInputElement;
    const deps: DepMap = JSON.parse(depInput.value);

    const result = await fetchManifest(deps);
    showResult(result);
  } catch (error: any) {
    showResult({ error: error.message });
  }
}

async function handleFetchModule() {
  try {
    const depInput = document.getElementById("depInput") as HTMLInputElement;
    const deps: DepMap = JSON.parse(depInput.value);
    const [[name, version]] = Object.entries(deps);

    const result = await fetchModule(name, version.replace(/[\^~]/g, ""));
    showResult(result);
  } catch (error: any) {
    showResult({ error: error.message });
  }
}

// 初始化页面
document
  .getElementById("fetchManifestBtn")
  ?.addEventListener("click", handleFetchManifest);
document
  .getElementById("fetchModuleBtn")
  ?.addEventListener("click", handleFetchModule);
