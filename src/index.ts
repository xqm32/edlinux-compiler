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
    return c.json({ message: "Compile Error", stderr: stderr.toString() });
  }

  let outputs = []
  // Run the compiled binary
  for (const { input, output } of cases) {
    const { stdout, stderr, exitCode } = await $`echo ${input} | ./${binaryFile}`
      .nothrow()
      .quiet();
    if (exitCode !== 0) {
      await $`rm ${binaryFile}`;
      return c.json({ message: "Runtime Error", stderr: stderr.toString() });
    }
    if (output === undefined) {
      outputs.push(stdout.toString());
    }
    else if (stdout.toString() !== output) {
      await $`rm ${binaryFile}`;
      return c.json({ message: "Wrong Answer", stdout: stdout.toString() });
    }
  }
  await $`rm ${binaryFile}`;
  return c.json({ message: "Accepted", outputs });
});

export default app;
