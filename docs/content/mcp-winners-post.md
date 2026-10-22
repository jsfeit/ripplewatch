# What the MCP servers that get used have in common

Published 2026-10-22 at /blog/what-mcp-servers-that-get-used-have-in-common. Nothing here names a company or quotes an adoption number we haven't checked. The [DATA] sentence in trait 4 was dropped before publishing because the registry count never finished loading; the published post is the draft below minus that sentence.

---

Walk through any MCP directory and you'll see the same thing. There's a server for debugging production errors, one for pipeline questions, one for support tickets, one for design files, one for your database, one for your calendar. MCP has quietly spread into almost every kind of work.

Most of those servers sit there. A few get opened every single day, by people who'd be annoyed if you took them away. That gap is more interesting than the count.

I've spent a while looking at which ones land and which ones don't. They share five traits. None of them is about the protocol.

## 1. The job is a question you ask in the middle of other work

The servers that stick don't ask you to start a new task. They answer something that came up while you were already doing one.

You're reading a pull request and wonder whether this error has shown up before. You're writing a reply and need the customer's plan. You're in a meeting and someone asks what we lost last quarter. The question arrives mid-flow, and the useful thing is an answer in the same window, right now.

Servers built around a workflow of their own, with steps and a destination, tend to lose to the product they wrap. A dedicated app is better at being an app.

## 2. The data lives somewhere you don't want to open

Every team has a few places they avoid. The billing dashboard with the odd export. The old reporting tool that takes a minute to load. The CRM view nobody trusts. People will do a lot to avoid opening them.

An MCP server wins when it makes one of those places unnecessary for the one thing you actually wanted. It doesn't replace the tool. It replaces the trip.

## 3. The question comes back

One-off questions don't build a habit. The ones that do are the ones you ask weekly: what changed, who's behind, what's blocked, what's about to go wrong. A server that answers a repeating question gets muscle memory. A server that answers a rare one gets forgotten, however clever it is.

## 4. Setup is one URL and one sign-in

This is where a lot of promising servers die. If getting started means finding a config file, pasting a key, and restarting something, most people stop at the config file.

The ones that spread are hosted, so there's nothing to install, and they sign you in through the normal login flow, so there are no keys to paste and nothing to rotate. [DATA: share of servers in the official registry that are hosted vs. run locally, as of this week.] People use what they can switch on in under a minute.

## 5. It mostly reads, and writing is small and obvious

Reading is safe. If a server gets an answer wrong, you notice and move on. Writing is where trust gets spent: send this, delete that, update the record.

The servers people leave switched on do mostly read, and the few things they write are small, clearly named, and easy to undo. "Log this note" is easy to trust. "Reorganize my workspace" is not.

## Where it isn't working yet

It would be dishonest to stop there, because a lot of this is still rough.

**Trust is the big one.** An assistant reads a tool's description and a tool's output as if they were reliable. Researchers have shown that a malicious description can quietly steer the assistant, and that text planted in a tool's output can do the same. Every server you add is something your assistant listens to. Most people haven't thought about that.

**A lot of servers have no real sign-in.** Some are open to anyone who finds the address. That's fine for public data and a problem for anything else. If a server touches your accounts and doesn't ask who you are, be suspicious of it.

**Too many tools makes the assistant worse.** Connect a dozen servers and the assistant has to choose among hundreds of tools. It chooses badly more often. More connected isn't more capable.

**And there's a lot of shelfware.** Plenty of servers exist because building one was easy, not because anyone needed it. Counting them says little about use.

## What this means if you're building one

Pick a question that people ask in the middle of their work, about data they'd rather not go and get, and that comes back every week. Make it hosted. Make sign-in the normal sign-in. Let it read first, and write only the small things.

If it doesn't pass those five, the protocol won't save it. If it does, you can write it in an afternoon and it'll still be open in a year.

We're building one.
