#!/bin/bash
echo "Looking for View"
grep -rn "View\." src/
echo "Looking for Quiz"
grep -rn "quiz\." src/
echo "Looking for UserProfile"
grep -rn "userData\." src/
echo "Looking for TitleDefinition"
grep -rn "title\." src/
echo "Looking for TitleCriteria"
grep -rn "criteria\." src/
echo "Looking for ErrorReport"
grep -rn "report\." src/
echo "Looking for BankQuestion"
grep -rn "question\." src/
echo "Looking for Question"
grep -rn "q\." src/components/QuizRoom.tsx
