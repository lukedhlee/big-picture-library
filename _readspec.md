# Condensed Book spec — read this fully before writing

You are writing a CONDENSED BOOK for The Big Picture Library: a long-form distillation that approximates actually reading the book. The reader is an AI PhD student at UC Berkeley. This is NOT a review, NOT an introduction, NOT reading notes — the existing overview pages already do that. Your job is to teach the book's actual content so thoroughly that a careful reader finishes knowing the full argument, the key evidence, the numbers, the stories, and the vocabulary — as if they had read the book attentively.

## Depth and length
- Full books: 5,000–8,000 words of body content. Essays/papers: 2,500–4,000 words.
- Follow the book's OWN structure: its real parts and chapters, in order. Merge thin adjacent chapters into one section where sensible; never invent structure the book doesn't have.
- Use WebSearch to verify the chapter list and any fact you are not sure of. No invented quotes, numbers, or anecdotes. If a figure is uncertain, write it approximately ("roughly", "on the order of") rather than fabricating precision.

## How to write each chapter section
- Open with the question the chapter is answering, then deliver the argument in full prose — the author's logic, in the author's order.
- Include the actual case studies and examples IN ENOUGH DETAIL THAT THEY DO THE EXPLANATORY WORK. Not "Smil discusses prime movers" but the content itself: what a prime mover is, the watt-by-watt progression from human muscle (~60–100 W sustained) to draft horse (~500–800 W) to steam engine to turbine, and why each jump rearranged society.
- Numbers, dates, names. Real books are persuasive because they are specific; your condensation must keep the specificity.
- Teach directly. "Perez divides each surge into two periods..." then actually explain installation and deployment so the reader could explain them to someone else.
- Keep the author's voice audible: signature phrases, recurring metaphors, the way they frame things. Quote sparingly and only what you can verify (use WebSearch); otherwise paraphrase closely without quotation marks.
- Minimal commentary. You may include ONE short passage near the end ("Reading it critically") noting major published criticisms or what has aged poorly — clearly separated from the book's own claims.

## HTML structure
- Follow /Users/lukedhlee/learning/big-picture-library/_template-read.html EXACTLY: same head, nav, layout classes, and the <script> block verbatim.
- TOC: one link per section, ids must match (#orient, #ch-1 ... #ch-N, #critical if present, #takeaways).
- Each chapter section: <section id="ch-N"> with <div class="chapter-label">Part/Chapter X</div> + <h2>chapter title</h2> + prose.
- Use <div class="concept">…</div> cards inline (sparingly, 3–6 total across the page) for crucial definitions; <blockquote> only for verified quotes with an attribution span.
- End with <section id="takeaways"> — "If you remember ten things" — an <ol> of ten crisp sentences.
- In the header meta-row, include: estimated reading time of THIS page (e.g. "~45 min read"), "Condenses the full ~Nh book", and a link <a href="SLUG.html">Back to the study page</a>.
- Title tag: "BOOK TITLE (Condensed) — The Big Picture Library".
- Eyebrow: "The Condensed Book · CATEGORY".

## Typography
Curly quotes (“”), em-dashes, &amp; for ampersands. No placeholders, no lorem ipsum. Valid HTML.

## Return value
One line: file path + approximate word count. Do not return the HTML.
