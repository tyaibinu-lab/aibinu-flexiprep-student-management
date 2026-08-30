export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 try{
  const{AIRTABLE_PAT,AIRTABLE_BASE_ID,ADMIN_PIN}=process.env;
  if(!AIRTABLE_PAT||!AIRTABLE_BASE_ID)return res.status(500).json({error:"Airtable environment variables are missing."});
  if(!ADMIN_PIN)return res.status(500).json({error:"ADMIN_PIN environment variable has not been configured."});
  if(String(req.query.pin||"")!==String(ADMIN_PIN))return res.status(401).json({error:"Invalid administrator PIN."});
  const headers={Authorization:`Bearer ${AIRTABLE_PAT}`};
  async function all(table){
   const out=[];let offset=null;
   do{
    let u=`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
    if(offset)u+=`?offset=${encodeURIComponent(offset)}`;
    const r=await fetch(u,{headers});const d=await r.json();
    if(!r.ok)throw new Error(`Airtable ${table} request failed.`);
    out.push(...(d.records||[]));offset=d.offset||null;
   }while(offset);return out;
  }
  const[students,exams,attempts]=await Promise.all([all("Students"),all("CBT_Exams"),all("CBT_Attempts")]);
  const studentMap=new Map(students.map(r=>{const f=r.fields||{};return[r.id,{id:String(f["Student ID"]??f["Student_ID"]??"").trim(),name:String(f["Full Name"]??`${f["First Name"]||""} ${f["Last Name"]||""}`.trim())}]}));
  const examMap=new Map(exams.map(r=>{const f=r.fields||{};return[r.id,{id:String(f["Exam ID"]||r.id),title:f["Exam Title"]||"",subject:f["Subject"]||"",questionCount:Number(f["Question Count"]||0),duration:Number(f["Duration Minutes"]||0),passMark:Number(f["Pass Mark"]||0),status:f["Status"]||""}]}));
  const first=v=>Array.isArray(v)&&v.length?(typeof v[0]==="string"?v[0]:v[0]?.id||""):"";
  const num=(f,names)=>{for(const n of names){if(f[n]!==undefined&&f[n]!==null&&f[n]!==""){const x=Number(f[n]);if(!Number.isNaN(x))return x}}return null};
  const rows=attempts.map(r=>{const f=r.fields||{};const s=studentMap.get(first(f["Student"]));const e=examMap.get(first(f["CBT Exam"])||first(f["Exam"]));const percentage=num(f,["Percentage","Score Percentage","Result Percentage"]);let result=String(f["Result Status"]??f["Result"]??f["Performance Status"]??"").toUpperCase();if(!result&&percentage!==null)result=percentage>=(e?.passMark??0)?"PASS":"FAIL";return{recordId:r.id,studentId:s?.id||"",studentName:s?.name||"",examId:e?.id||"",examTitle:e?.title||"",percentage,result,status:f["Attempt Status"]||"",startTime:f["Start Time"]||"",submitTime:f["Submit Time"]||""}}).sort((a,b)=>new Date(b.submitTime||b.startTime||0)-new Date(a.submitTime||a.startTime||0));
  const submitted=rows.filter(x=>x.submitTime||x.result||x.percentage!==null);const passed=submitted.filter(x=>x.result==="PASS").length;
  return res.status(200).json({success:true,counts:{students:students.length,exams:exams.length,attempts:attempts.length,passRate:submitted.length?Math.round(passed/submitted.length*100):0},exams:[...examMap.values()],recentAttempts:rows.slice(0,50)});
 }catch(e){console.error(e);return res.status(500).json({error:"Failed to load CBT dashboard.",details:e.message})}
}
