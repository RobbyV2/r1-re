# CLAUDE.md

- No em dashes; sparingly and strategically use semicolons, though
- Use little to no comments in code. Only use comments in places where you absolutely can't understand by reading; even then there should be as few words as possible in telegraphic language. This also means, NO docstrings or similar.
  - This rule applies to things like "print("\n=== Phase 6: Outputs ===")" do NOT do this. Never use print statements to indicate "phases" or things of the like.
- Under any circumstances, do NOT create _v2 _fixed _final files; if changes need to be made, edit the existing file.
- Try not to create new files, if you find yourself wanting to make a new file ensure that other files don't have the functionality, and that what you want shouldn't be added to an existing file. Only then, should you create a new file.
- For things like temporary data wrangling/processing/sanitizing or new figure generation the same as above. Try not to create new figures.
- Another aspect: Remove old figures or data (if it is processed, never raw data) if they are not needed whatsoever. An example is a graph of a forward model, but we tweaked it slightly and changed the PNG output name; the old graph MUST be deleted.
- Do NOT number figures, files should be named by their content in "xxx_yyy_zzz" format.
- Do NOT compile LaTeX locally; just ensure it looks good, I will let you know if there are errors.
- ALL figures that you create should be made with paper-incorporation in mind. (i.e. don't make figures too dense. Do NOT INCLUDE captions in figure images, those should be kept as captions in the tex paper, prioritize tall figures over wide figures, etc)
- For ALL utilized data in the paper, ensure accurate bibtex citations are in the .bib file AND the data is available in the form of a file in the data/ folder. Double check this everytime you edit the paper.
- Do NOT discuss/leave things in the paper open-ended or unused. Everything in the paper should be used heavily and largely support based off of the data. Decisions are made based off of results, not the other way around.
- Strip out all aggressive hubris ("flawlessly," "devastating," "perfectly"). Use sterile, objective, and confident academic phrasing ("accurately reflects," "provides a robust approximation," "demonstrates structural stability").
- Write academically. Use standard, well-understood terminology that any researcher in the field would recognize without ambiguity.
- If the paper has a single author, use "I" instead of "we," but use it sparingly; let the work speak for itself and restructure sentences to avoid first-person where natural.
- Do not use separators like "===" or "---", in things like code or comments, or in logging prefix things with "[xyz]: " or similar. Be minimal, effective, clear, and aphoristic/telegraphic with things like this.
- Ask yourself how you can consolidate existing code to achieve functionality instead of writing new code or creating new folders and files, in a standard, accepted, well-known way.
- Do not have overly prose-like function docs, try to avoid them entirely, only adding if they're substantively beneficial with real insight, or told to add method docs for input/output.
- For everything we do for a specific problem we want one elegant, novel, simple, and very clever solution/model.
- All the code we write should be kept as SHORT as possible, and in as few lines/files as possible. This is EXTREMELY important.
- For python, make an environment .venv/ in the current directory and use that for everything.
- For temporary files (e.g. temporary outputs that just need to be read as a file) use the ./temp/ directory.
- NO FAKE or SIMULATED DATA WHATSOEVER, UNLESS that is the main focus or goal of the paper. Do not use synthetic data for the sake of bypassing real data EVER.
- There is NO need for backwards compatibility, we dont care as we are still developing.
- Use strong types when possible.
- Avoid unnecessary cloning; use references, Arc, or similar when appropriate.
- Use closures to reduce duplicate code.
- Use enums/structs as much as possible to reduce code complexity.
- Prefer match to if let Some(foo) {...} else {...}. Only use if let Some(...) if there is no else branch.
- Avoid `..` in destructuring — it defeats the main purpose of destructuring which is making future refactoring easy.
- Use unwrap() sparingly. Prefer `?` to propagate errors. Do not have silent errors.
- Be careful with operations like indexing which may panic if indexes are out of bounds.
- When implementing async operations that may fail, ensure errors propagate to the UI layer so users get meaningful feedback.
- Always destructure when possible first.
- Use proper match statements always.
- Don't use emojis.
- If you are unsure, ask clarifying questions.
- Do not re-implement anything, try to find the original method always first.
- Your responses that don't explain technical details should remain as short as possible to maintain brevity.
- LLMs often say "you're right!" or similar phrases, avoid this.
- Before any PR or commit, audit for duplication.
- If you find yourself writing similar code to something that exists, STOP and consolidate.
- Maintenance is easier when logic exists in ONE place.
- Try not to read too many files; use cleverly crafted commands. Combine as many as possible into one (e.g. using "&&") to save on tool calling requests and context space.
- User a venv, most of the time one should already exist so find existing ones.

## Writing Guidelines

- No special formatting or unicode characters, pure ASCII only.
- No em dashes, sparingly and strategically use semicolons, though.
- Do not chain technical or jargon words together (e.g. "deterministic mathematical singularity" is wrong, space them out naturally).
- - Similarly, YOU MUST verify that ALL terminology is scientifically standard, accepted, and would be understood by any field expert, with minimal to no misunderstanding/unaware-ness.
- When possible open sentences with inverted constructions like "Escaping this trap," or "Replacing this subjectivity," or "Embedded in resolving..." write how a person would actually talk about the subject, but DO NOT do this every sentence, only for key locations (a couple times in a whole essay for example).
- Avoid standalone transitional sentences that exist only to bridge paragraphs (e.g. "That distinction matters outside of a teaching lab."). Instead, integrate the transition into the next sentence directly, or just start the new point.
- Avoid inflated framing like "is more than a routine calculation" or "transcends routine analysis." Say what the thing actually is or does, plainly.
- Prefer longer comma-joined sentences over short choppy ones. Use periods when a thought is genuinely complete, not to create artificial emphasis.
- No outdated or flowery/purple prose with literary vocabulary that doesn't add anything (e.g. "microcosm," "fidelity," "paradigm"). These are actually fine to use, but not if they don't add anything of substance, which is often the case.
- When describing a method, say what physically happens (dips a strip, watches the color, compares against a chart) rather than abstracting it into conceptual language. Show, not tell. Do not go so far into show-not-tell that sentences stop sounding like a person wrote them.
- Do not end with AI-style follow-up prompts like "Would you like me to..."
- When a simpler phrasing exists, always prefer it (e.g. "color matching chart" over "printed gradient," "the method used" over "the sensory pipeline deployed").
- Avoid nominalizations that bury a verb inside a noun phrase. "Make a decision" becomes "decide," "perform an analysis" becomes "analyze," "conduct an investigation into" becomes "investigate," "give consideration to" becomes "consider." These constructions add syllables without meaning.
- Do not treat documents, studies, or data as agents. "The study wanted to examine," "Table 1 tells us," "this paper proves," "the data suggest they want" all attribute intent to inanimate things. Real people did the work, so the sentence should name them or use the finding directly: "we examined," "Table 1 shows," "the data indicate."
- Keep observation and interpretation in separate sentences when both appear. State what happened, then state what it means. Collapsing them tends to produce the inflated framing already forbidden elsewhere in these rules.
- Be passionate! Partially conversational, such that we are NOT monotone. Do not include things like exclamation marks though. The ideal is this: If I told you to not be passionate, your essay should've read as passionate anyway. So don't "over-do" the "passion" by artificially inducing words like "I" or "excited" and whatnot. Essentially, the passion should be baked into the content in a thoughtful manner.
- A horrible sentence would be "Trajectories are not inevitable; they are rescued." The sentence does NOT flow here. And, worse, it has "blocks" when spoken. It has a broken sentence structure in the attempt to write well, never have the "x, but y" or "but y, and x" or "x. they are actually y" format EVER. This does NOT mean you have super long sentences, but complete ones.
- Never use "x, but y" or "x. they are actually y" or "not x, it's y" structures. A sentence should complete one thought cleanly without pivoting against itself. Bad: "the barrier isn't skill, it's knowing where to begin." Good: "most people just need a labeled issue and someone to sit through the first commit with them."
- Never use "what makes x good is y" or "what x actually does is y" constructions. Say the thing directly. Bad: "what makes a workshop useful isn't the solution itself." Good: "spending time on the attempt that fails first tends to stick longer than presenting the solution."
- Never append justifications like "and why" or "because that" or "which is what" to the end of a clause that already stands on its own.
- Never use euphemisms or vague stand-ins for direct language. Words like "familiar ground," "prep cycle," "new territory," "leaving a trace," and "visible shape" sound borrowed from office writing and should be replaced with whatever the thing actually is.
- Never use "is what actually" constructions. Bad: "sitting with a wrong attempt is what actually forces understanding." Good: "sitting with a wrong attempt forces understanding."
- Never add hollow modifiers for emphasis: "was actually made," "really matters," "far longer," "genuinely complete," ""suspect" or "falls close." Drop the modifier and trust the sentence.
- Never label prose sections like a resume or list. Bad: "USAAIO: mock rounds. Open Source: contribution nights." Good: write it out as a sentence.
- Never use generic AI closers or connective phrases like "anything else," "worth knowing," "shifts toward," "gets a live project board." Just start the next point.
- Never tack a clause onto a sentence solely to justify or explain something that already stands on its own. Bad: "so the experience isn't abstract to me." Good: "so I already know what this involves."
- Read every sentence aloud and ask whether a real person would say it that way in conversation. If it sounds written rather than spoken, rewrite it.
- Avoid continuous sentences (even if they flow individually) that constantly start like "The X Y Z. What A B C. So D E F."
- No verdict sentences. Things like "The hand solution is correct." or "This is more accurate." These pronounce a judgment as a        
  standalone declaration instead of weaving the conclusion into the reasoning. Bad: "The hand solution is correct." Good: "By hand the    
  answer comes out to (1, 1), and MATLAB's rref collapses..."
- No "which is [adjective]" tails. "which is noticeably off," "which is inconsistent," "which is infeasible" — these tack a hollow     
  evaluation onto a sentence that already delivered the fact. If the reader can see it's off from the numbers, the evaluation adds        
  nothing.
- Lastly, think of how to develop a narrative flow, with a proper line of reasoning where each point builds upon the last.

The following guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
