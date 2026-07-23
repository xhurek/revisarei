# Security Specification - Revisarei

## Data Invariants
1. Flashcards MUST belong to the authenticated user.
2. Quizzes MUST have a creator (`userId`) which matches the requester for private quizzes.
3. Public quizzes can be read by any authenticated user.
4. Comments can be created by any authenticated user on public quizzes.
5. Notifications can only be read/deleted by the recipient.
6. User settings (folder colors) can only be managed by the owner.

## The Dirty Dozen Payloads

1. **Spoofed Flashcard Creation**: Create a flashcard with `userId` of another user.
2. **Unauthorized Quiz Read**: Read a private quiz belonging to someone else.
3. **Public Quiz Hijack**: Update the `questions` or `title` of a public quiz not owned by the requester.
4. **Notification Scraping**: List notifications belonging to another user.
5. **PII Injection**: Inject large strings or nested objects into `userName` in comments to cause resource exhaustion.
6. **Setting Manipulation**: Update someone else's `folderColors`.
7. **Comment Forgery**: Post a comment where `userId` doesn't match the current user's UID.
8. **Stat Tampering**: Update `stats` of another user.
9. **Flashcard Interval Poisoning**: Set a negative `interval` or huge `easeFactor`.
10. **Notification Spam**: Create thousands of notifications for random users.
11. **Quiz Tag Poisoning**: Set a extremely long `tag` string.
12. **Comment Deletion**: Delete a comment you didn't write.

## Test Strategy (Draft)
- Verify `userId` equality for all user-owned collections.
- Verify `isPublic` check for quiz reads.
- Enforce `affectedKeys().hasOnly()` for setting updates.
- Enforce strict size limits on all strings.
