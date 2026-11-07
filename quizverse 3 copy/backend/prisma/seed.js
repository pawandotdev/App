import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const data = [
 ["Programming","JavaScript Basics","EASY",[["Which keyword declares a constant?","const","var","def","dim"],["What does === check?","Value and type","Only value","Only type","Memory address"],["Which is NOT a JS data type?","Float","String","Boolean","Symbol"]]],
 ["Programming","React Essentials","MEDIUM",[["Which hook manages state?","useState","useFetch","useRoute","useData"],["JSX stands for?","JavaScript XML","Java Syntax Extension","JSON XML","JS Extra"],["Props are...?","Read-only inputs","Mutable state","Global vars","CSS rules"]]],
 ["Science","Space Facts","EASY",[["Largest planet?","Jupiter","Mars","Venus","Earth"],["Chemical symbol for water?","H2O","CO2","O2","NaCl"],["Speed of light is about?","300,000 km/s","30,000 km/s","3,000 km/s","3 million km/s"]]],
 ["History","World History","HARD",[["WW2 ended in?","1945","1939","1918","1950"],["First US president?","George Washington","Lincoln","Jefferson","Adams"],["Berlin Wall fell in?","1989","1961","1975","1991"]]],
];
const cats = {};
for (const [c,title,difficulty,qs] of data) {
  cats[c] ??= await db.category.upsert({where:{name:c},update:{},create:{name:c}});
  await db.quiz.create({data:{title,difficulty,categoryId:cats[c].id,questions:{create:qs.map(([text,a,...w])=>({text,options:{create:[{text:a,isCorrect:true},...w.map(t=>({text:t}))]}}))}}});
}
for (const a of [["first_quiz","First Quiz","Complete your first quiz"],["perfect_score","Perfect Score","Get every question correct"]])
  await db.achievement.upsert({where:{key:a[0]},update:{},create:{key:a[0],name:a[1],description:a[2]}});
console.log("Seeded"); await db.$disconnect();
