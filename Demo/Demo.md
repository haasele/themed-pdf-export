
---

## Basic Typography
Normal paragraph with **bold text**, *italics text* and 'inline code'. You can also [put links](https://github.com/haasele) which will be nicely highlighted.

### Subsection
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa, cum sociis natoque penatibus.

#### Small Heading
Perfect for Deep-Hierachy projects.


## Callout Blocks

> [!NOTE]
> This is a normal Hint box, perfect for informing People.

> [!TIP]
> Use `Bun.markdown.html()` for fast Mardown to HTML conversation.

> [!WARNING]
> The `Bun.markdown` API is still marked as **unstable**.

> [!DANGER]
> Never render unverified User Inputs — No builtin XSS-Protections!

> [!INFO]
> GFM-Extensions like Tables, Strikethrough and Task Lists active by default.

---

## Blockquote

> "The measure of intelligence is the ability to change."
> — Albert Einstein

---

## Lists

**Unordered:** 
- Bun is a fast JavaScript runtime 
- Built-in bundler, tester, and package manager 
- Zig-written Markdown engine - CommonMark compliant - GFM extensions included 

**Ordered:** 
1. 'bun init' — create a project 
2. 'bun add hono' — Install the framework 
3. 'bun run server.ts' — start server

**Task List:**
- [x] Embed Markdown Parser 
- [x] Implement Callout Blocks 
- [ ] Add syntax highlighting 
- [ ] Build search function

---

## Code

Inline: Start a Server with `bun run server.ts`.

**Block:**

```typescript
import { serve } from "bun";

serve({
  port: 3000,
  async fetch(req) {
    const md = await Bun.file("./README.md").text();
    const html = Bun.markdown.html(md);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  },
});
```

---

## Table

| Feature         | Bun          | Node.js         |
| --------------- | ------------ | --------------- |
| Startup-Time    | ~5ms         | ~50ms           |
| Markdown Parser | ✓ native     | ✗ external      |
| TypeScript      | ✓ native     | via tsx/ts-node |
| Package Manager | ✓ integrated | npm/yarn        |
| Test Runner     | ✓ integrated | jest/vitest     |

---

## Strikethrough & more GFM 

~~This text is crossed out~~ 

Autolink: https://github.com/haasele is automatically linked.


---


## Images

Paste in Images and give them ALT Text Descriptions.

```
![Minion|226x226](https://octodex.github.com/images/minion.png)![Stormtroopocat|228]
```
![Minion|226x226](https://octodex.github.com/images/minion.png)![Stormtroopocat|228](https://octodex.github.com/images/stormtroopocat.jpg "The Stormtroopocat")
