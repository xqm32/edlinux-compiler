import { $ } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";

interface cases {
  input: string;
  output?: string;
}

interface Body {
  language?: string;
  code?: string;
  cases?: cases[];
}

const app = new Hono();

app.use(cors());

app.post("/", async (c) => {
  let { language, code, cases } = await c.req.json<Body>();
  language = language || "c";
  code = code || "";
  cases = cases || [];

  const hash = Bun.hash(code).toString(16).substring(0, 8);

  // Write the source code to a file
  const sourceFile = `${hash}.${language}`;
  await Bun.write(sourceFile, code);

  // Compile the source code
  const binaryFile = `${hash}`;
  const { stderr, exitCode } = await $`zig cc ${sourceFile} -o ${binaryFile}`
    .nothrow()
    .quiet();
  await $`rm ${sourceFile}`;
  if (exitCode !== 0) {
    // Remove empty binary file
    await $`rm -f ${binaryFile}`;
    return c.json({
      code: "CE",
      message: "编译错误",
      stderr: stderr.toString(),
    });
  }

  let outputs = [];
  // Run the compiled binary
  for (const { input, output } of cases) {
    const { stdout, stderr, exitCode } =
      await $`echo ${input} | ./${binaryFile}`.nothrow().quiet();
    if (exitCode !== 0) {
      await $`rm ${binaryFile}`;
      return c.json({
        code: "RE",
        message: "运行错误",
        stderr: stderr.toString(),
      });
    }
    if (output === undefined) {
      outputs.push(stdout.toString());
    } else if (stdout.toString() !== output) {
      await $`rm ${binaryFile}`;
      return c.json({
        code: "WA",
        message: "答案错误",
        stderr: `预期输出：\n${output}\n实际输出：\n${stdout.toString()}`,
      });
    }
  }
  await $`rm ${binaryFile}`;
  if (outputs.length > 0) {
    return c.json({ code: "TEST", message: "运行完成", outputs });
  } else {
    return c.json({ code: "AC", message: "全部正确" });
  }
});

export default app;
