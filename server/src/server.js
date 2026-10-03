import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import {createClient} from "@supabase/supabase-js";
import {z} from "zod";

const app=express(),port=Number(process.env.PORT||5000);
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:process.env.CORS_ORIGIN?.split(",").map(x=>x.trim())||"*"}));
app.use(express.json({limit:"1mb"}));app.use(morgan("tiny"));

app.get("/api/health",(req,res)=>res.json({ok:true,service:"KMSFLIMS API"}));

app.get("/api/movies",async(req,res)=>{
 const limit=Math.min(Number(req.query.limit||50),100);
 const {data,error}=await db.from("kms_movies").select("*").eq("published",true).order("created_at",{ascending:false}).limit(limit);
 if(error)return res.status(500).json({error:error.message});res.json({movies:data});
});

app.get("/api/movies/search",async(req,res)=>{
 const q=String(req.query.q||"").trim();if(!q)return res.json({movies:[]});
 const {data,error}=await db.from("kms_movies").select("*").eq("published",true)
  .or("title.ilike.%"+q+"%,genre.ilike.%"+q+"%,description.ilike.%"+q+"%,description_rw.ilike.%"+q+"%").limit(50);
 if(error)return res.status(500).json({error:error.message});res.json({movies:data});
});

app.get("/api/movies/:id",async(req,res)=>{
 const {data:movie,error}=await db.from("kms_movies").select("*").eq("id",req.params.id).eq("published",true).maybeSingle();
 if(error)return res.status(500).json({error:error.message});if(!movie)return res.status(404).json({error:"Movie not found"});
 const [ep,tr]=await Promise.all([
  db.from("kms_episodes").select("*").eq("movie_id",movie.id).order("episode_number"),
  db.from("kms_trailers").select("*").eq("movie_id",movie.id).order("is_primary",{ascending:false})
 ]);
 res.json({movie,episodes:ep.data||[],trailers:tr.data||[]});
});

async function youtubeSearch(q,limit=12){
 const key=process.env.YOUTUBE_API_KEY;if(!key)return [];
 const u=new URL("https://www.googleapis.com/youtube/v3/search");
 [["part","snippet"],["type","video"],["videoEmbeddable","true"],["videoSyndicated","true"],["maxResults",String(Math.min(limit,50))],["q",q.slice(0,120)],["regionCode","RW"],["relevanceLanguage","rw"],["key",key]].forEach(([k,v])=>u.searchParams.set(k,v));
 const r=await fetch(u),d=await r.json();if(!r.ok)throw new Error(d?.error?.message||"YouTube API error");
 return (d.items||[]).filter(x=>x.id?.videoId).map(x=>({id:x.id.videoId,title:x.snippet.title,description:x.snippet.description,channelTitle:x.snippet.channelTitle,thumbnail:x.snippet.thumbnails?.high?.url||x.snippet.thumbnails?.medium?.url}));
}
app.get("/api/youtube/trailers",async(req,res)=>{try{res.json({videos:await youtubeSearch(String(req.query.q||"film trailer"),Number(req.query.limit||12))})}catch(e){res.status(502).json({error:e.message})}});
app.get("/api/youtube/trailer",async(req,res)=>{try{const v=await youtubeSearch(String(req.query.movie||"")+" official trailer",10);res.json({videoId:v[0]?.id||null})}catch(e){res.status(502).json({error:e.message})}});

app.post("/api/translate",async(req,res)=>{
 const parsed=z.object({text:z.string().min(1).max(30000),source:z.string().default("en"),target:z.string().default("rw"),movie_id:z.string().uuid().optional()}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:"Invalid translation request"});
 const key=process.env.GOOGLE_TRANSLATION_API_KEY;if(!key)return res.status(503).json({error:"GOOGLE_TRANSLATION_API_KEY is not configured"});
 const {text,source,target,movie_id}=parsed.data;
 const r=await fetch("https://translation.googleapis.com/language/translate/v2?key="+key,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({q:text,source,target,format:"text"})});
 const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||"Translation failed"});
 const translated=d.data?.translations?.[0]?.translatedText||"";
 if(movie_id)await db.from("kms_translations").upsert({movie_id,source_language:source,target_language:target,source_text:text,translated_text:translated,provider:"google-cloud-translation"},{onConflict:"movie_id,source_language,target_language,source_text"});
 res.json({translatedText:translated,source,target});
});

app.post("/api/admin/movies",async(req,res)=>{
 if(req.headers["x-admin-secret"]!==process.env.ADMIN_SECRET)return res.status(401).json({error:"Unauthorized"});
 const parsed=z.object({title:z.string().min(1),slug:z.string().min(1),type:z.enum(["Movie","Series"]).default("Movie"),genre:z.string().default("Drama"),year:z.number().int().nullable().optional(),poster_url:z.string().url().nullable().optional(),video_url:z.string().url().nullable().optional(),download_url:z.string().url().nullable().optional(),description:z.string().nullable().optional(),description_rw:z.string().nullable().optional(),translator:z.string().default("KMS"),featured:z.boolean().default(false),published:z.boolean().default(true)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:parsed.error.issues});
 const {data,error}=await db.from("kms_movies").insert(parsed.data).select().single();if(error)return res.status(400).json({error:error.message});res.status(201).json({movie:data});
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Unexpected server error"})});
app.listen(port,()=>console.log("KMSFLIMS API on http://localhost:"+port));