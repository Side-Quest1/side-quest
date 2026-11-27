const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

test("native containers have no literal string children after JSX compilation", () => {
  for (const file of [
    "apps/mobile/App.tsx",
    "apps/mobile/Connected.tsx",
    "apps/mobile/device-alerts.tsx",
    ...fs.readdirSync("packages/application/src").filter(file=>file.endsWith(".tsx")).map(file=>"packages/application/src/"+file),
    "packages/ui/src/native.tsx",
    "packages/ui/src/quest-card.native.tsx",
  ]) {
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    const tree = ts.createSourceFile(
      file + ".js",
      js,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function inspect(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(tree) === "React.createElement"
      ) {
        const [tag, , ...children] = node.arguments;
        if (
          [
            "View",
            "Card",
            "SafeAreaView",
            "KeyboardAvoidingView",
            "ScrollView",
            "Pressable",
            "Section","ui.Section","ImageBackground","ui.Screen","ui.Exposure",
          ].includes(tag.getText(tree))
        )
          assert.ok(
            children.every((child) => !ts.isStringLiteral(child) && !ts.isNumericLiteral(child) &&
              !(ts.isBinaryExpression(child) && child.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken &&
                ts.isPropertyAccessExpression(child.left) && child.left.name.text==="length")),
            file + ": " + node.getText(tree).slice(0, 100),
          );
      }
      ts.forEachChild(node, inspect);
    }
    inspect(tree);
  }
});
