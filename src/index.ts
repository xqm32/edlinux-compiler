import { $ } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";

interface Body {
  language: string;
  code: string;
  input: string;
}

const app = new Hono();

app.use(cors());

app.post("/", async (c) => {
  const { language, code, input } = await c.req.json<Body>();
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
    return c.json({ stderr: stderr.toString() });
  }

  // Run the compiled binary
  const command =
    input === "" ? $`./${binaryFile}` : $`./${binaryFile} < ${input}`;
  const { stdout } = await command.nothrow().quiet();
  await $`rm ${binaryFile}`;
  return c.json({ stdout: stdout.toString() });
});

export default app;
