import { Sandpack } from "@codesandbox/sandpack-react";

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <Sandpack
        template="react"
        theme="dark"
        options={{
          showNavigator: true,
          showTabs: true,
          bundlerURL: "http://localhost:4587/"
        }}
        customSetup={{
          dependencies: {}
        }}
        files={{
          "/App.js": `export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Hello Sandpack!</h1>
      <p>Start editing to see the magic ✨</p>
    </div>
  );
}`
        }}
      />
    </div>
  );
}
