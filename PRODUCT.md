# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and his friends/acquaintances: Vietnamese speakers learning English vocabulary. They mostly study on a phone in short spare moments (5–15 minutes). Friends may be first-time users who need the flow to be obvious without explanation from the owner.

## Product Purpose

A daily English vocabulary routine that makes words stick. Success = the learner comes back every day, finishes the day's routine, and the estimated vocabulary grows.

## Positioning

Not a flashcard deck: one guided daily routine built on research (spaced repetition with FSRS, active recall, Nation's four strands): review → learn 5 new words at a time → write own sentences → read a short passage. Vietnamese-first UI and meanings.

## Operating Context

- Phone, one hand, short sessions, often interrupted; must resume exactly where it left off.
- Signed in with Google; progress syncs across devices.
- Audio matters: pronunciation buttons, listening quizzes, read-aloud.

## Capabilities and Constraints

- Static site on GitHub Pages; Firebase Auth (Google) + Firestore per-user data; IndexedDB local mirror.
- Word list: NGSL ~2,800 words in frequency order; 16 topic tags; AI-generated examples, collocations, word families and 141 reading passages.
- Review modes: choose meaning, recall meaning, listen & type, type the English word.
- Placement test: yes/no + meaning verification with formula scoring and pseudowords.
- UI language: Vietnamese. English content shown as-is.

## Evidence on Hand

No testimonials, user counts or metrics exist; never fabricate them.

## Product Principles

1. One obvious next action at every moment ("Tiếp tục học").
2. Short sessions win: everything must work in 5 minutes on a phone.
3. Honest progress: show real recall, never inflate.
4. Recall before reveal: the learner tries first, then sees the answer.
