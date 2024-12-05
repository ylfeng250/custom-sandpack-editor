import { retryFetch } from "./retry-fetch";
import { analyzeDependencies, extractTarball } from "./npm-utils";
export type DepMap = { [depName: string]: string };

const NPM_REGISTRY = "https://registry.npmmirror.com/";

export interface IResolvedDependency {
  n: string; // name
  v: string; // version
  d: number; // depth
}

export type CDNModuleFileType = ICDNModuleFile | number;

export interface ICDNModuleFile {
  c: string; // content
  d: string[]; // dependencies
  t: boolean; // is transpiled
}

export interface ICDNModule {
  f: Record<string, CDNModuleFileType>; // files
  m: string[]; // transient dependencies 依赖的依赖
}

interface INpmPackageInfo {
  name: string;
  versions: Record<
    string,
    {
      version: string;
      dist: {
        tarball: string;
      };
      dependencies?: Record<string, string>;
    }
  >;
  "dist-tags": {
    latest: string;
  };
}

async function resolveVersion(
  name: string,
  versionRange: string
): Promise<string> {
  const response = await retryFetch(`${NPM_REGISTRY}${name}`, {
    maxRetries: 5,
  });
  const packageInfo: INpmPackageInfo = await response.json();

  // 简单实现：如果是 ^ 或 ~ 开头，使用最新版本
  if (versionRange.startsWith("^") || versionRange.startsWith("~")) {
    return packageInfo["dist-tags"].latest;
  }
  return versionRange.replace(/[^0-9.]/g, "");
}

async function fetchPackageInfo(
  name: string,
  version: string
): Promise<{
  tarballUrl: string;
  dependencies: Record<string, string>;
}> {
  const response = await retryFetch(`${NPM_REGISTRY}${name}/${version}`, {
    maxRetries: 5,
  });
  const packageInfo = await response.json();

  return {
    tarballUrl: packageInfo.dist.tarball,
    dependencies: packageInfo.dependencies || {},
  };
}

async function downloadAndExtractTarball(
  url: string
): Promise<Map<string, string>> {
  const response = await retryFetch(url, { maxRetries: 5 });
  const arrayBuffer = await response.arrayBuffer();
  return extractTarball(arrayBuffer);
}

export async function fetchManifest(
  deps: DepMap
): Promise<IResolvedDependency[]> {
  const resolvedDeps: IResolvedDependency[] = [];

  for (const [name, versionRange] of Object.entries(deps)) {
    const version = await resolveVersion(name, versionRange);
    resolvedDeps.push({
      n: name,
      v: version,
      d: 0, // 简化处理，深度都设为0
    });

    // 获取依赖的依赖
    const { dependencies } = await fetchPackageInfo(name, version);
    for (const [depName, depVersion] of Object.entries(dependencies)) {
      const resolvedVersion = await resolveVersion(depName, depVersion);
      resolvedDeps.push({
        n: depName,
        v: resolvedVersion,
        d: 1,
      });
    }
  }

  return resolvedDeps;
}

export async function fetchModule(
  name: string,
  version: string
): Promise<ICDNModule> {
  console.log("执行");
  const { tarballUrl } = await fetchPackageInfo(name, version);
  console.log(tarballUrl);
  const files = await downloadAndExtractTarball(tarballUrl);

  // 转换文件格式为 ICDNModule 格式
  const moduleFiles: Record<string, CDNModuleFileType> = {};
  const allDependencies = new Set<string>();

  for (const [path, content] of files.entries()) {
    if (
      path.endsWith(".js") ||
      path.endsWith(".jsx") ||
      path.endsWith(".ts") ||
      path.endsWith(".tsx")
    ) {
      // 分析文件中的依赖
      const deps = analyzeDependencies(content);
      deps.forEach((dep) => allDependencies.add(dep));

      moduleFiles[path] = {
        c: content,
        d: deps,
        t: false, // 标记为未转译
      };
    } else if (path.endsWith(".json")) {
      moduleFiles[path] = {
        c: content,
        d: [],
        t: true, // JSON 文件不需要转译
      };
    }
  }

  return {
    f: moduleFiles,
    m: Array.from(allDependencies), // 收集所有传递依赖
  };
}
