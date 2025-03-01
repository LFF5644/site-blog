// CREATED 22.02.2025 AT 15:13
const blogArticlesFile="data/blog/articles.json";
const blogArticlesDir="data/blog/";
const defaultBlogFileName="blog.txt";

const {
	createDirAsync,
	readFileAsync,
	readJsonFileAsync,
	writeJsonFileAsync,
	writeFileAsync,
	rmFileAsync,
	renameAsync,
	tofsStr,
}=globals.functions;

const getDateUpsideDown=(date=new Date(),sub=".")=> date.getFullYear()+sub+String(date.getMonth()+1).padStart(2,0)+sub+String(date.getDate()).padStart(2,0);
const getTimeUpsideDown=(date=new Date,sub=":")=> String(date.getHours()).padStart(2,0)+sub+String(date.getMinutes()).padStart(2,0);

const excludeTemplate=(object,template)=>Object.fromEntries(Object.entries(object).filter(item=>template[item[0]]!==item[1]));

const loadBlogArticlesFile=async()=>{
	log("Load: "+blogArticlesFile);
	const articles=await readJsonFileAsync(blogArticlesFile);
	if(!articles) this.articles=[];
	else this.articles=articles.map(this.getArticleTemplate);
}
const saveBlogArticlesFile=()=>{
	const template=this.articleTemplate;
	let articles=this.getArticles().map(item=>excludeTemplate(item,template));
	if(articles.length===0){
		log("dont save empty file: "+blogArticlesFile);
		return rmFileAsync(blogArticlesFile);
	}
	else{
		log("Save: "+blogArticlesFile);
		return writeJsonFileAsync(blogArticlesFile,articles);
	}
}

const saveSavedArticleFile=async()=>{
	log("Save: "+blogArticlesDir+"saved/article.json");
	await createDirAsync(blogArticlesDir+"saved");
	await writeJsonFileAsync(blogArticlesDir+"saved/article.json",excludeTemplate(this.savedArticle,this.articleTemplate));
}
const loadSavedArticleFile=async()=>{
	log("Load: "+blogArticlesDir+"saved/article.json");
	const article=this.getArticleTemplate(await readJsonFileAsync(blogArticlesDir+"saved/article.json")||{});
	if(!article) this.savedArticle=this.getArticleTemplate();
	else this.savedArticle=article;
}

this.start=async()=>{
	await createDirAsync("data/blog"); // erstellen des "blog" ordners im daten speicher!
	
	await loadBlogArticlesFile();
	await loadSavedArticleFile();

	this.saveInterval=setInterval(this.save,1e3*20); // autosave all 20s
}

this.createArticle=async(article)=>{
	log("create article...");
	article=this.getArticleTemplate(article);
	const articleCreatedDate=new Date(article.created);
	if(!article.title||!article.description) throw new Error("blog article not have description or title, but its required!");
	if(!article.articleText&&(!article.folder||!article.articleFile)) throw new Error("blog article is not given!");

	if(!article.id) article.id=this.articles.length+1;

	if(!article.folder||article.folder==="saved"){
		const newFolder=getDateUpsideDown(articleCreatedDate,"-")+"_"+getTimeUpsideDown(articleCreatedDate,"-");
		await createDirAsync(blogArticlesDir+newFolder);
		if(article.folder==="saved"){
			for(const file of article.files){
				log(`moving '${blogArticlesDir}': 'saved/${file}' => '${newFolder}/' ...`);
				await renameAsync(blogArticlesDir+"saved/"+file,blogArticlesDir+newFolder+"/"+file);
			}
			log("moved "+article.files.length+" successfully!")
		}
		article.folder=newFolder;
	}
	if(!article.articleFile&&article.articleText){
		article.articleFile=defaultBlogFileName;
		await writeFileAsync(blogArticlesDir+article.folder+"/"+defaultBlogFileName,article.articleText);
		log("written: "+blogArticlesDir+article.folder+"/"+defaultBlogFileName,article.articleText+" with "+article.articleText.length/1024+" KB");
		delete article.articleText;
	}
	log("NEW ARTICLE CREATED: "+article.title+", files: "+article.files.length+", visibility: "+article.visibility);
	this.articles.push(article);
	this.saveRequired=true;
	return article
}
this.editArticle=(article,articleText=null)=>{
	article={
		...article,
		...this.getArticle(article.id),
	};
	const articleIndex=this.articles.findIndex(item=>item.id===article.id);
	if(articleIndex===-1) throw new Error("article not found");

	log("edit Article '"+article.title+"'");
	this.articles[articleIndex]=article;
	this.saveRequired=true;

	if(articleText){
		log("edit ArticleText '"+article.title+"',saving...");
		const file=blogArticlesDir+articles.folder+"/"+article.articleFile;
		return writeFileAsync(file,articleText);
	}
}

this.getArticles=()=>this.articles;
this.existArticle=id=> this.articles.some(item=>item.id===id);
this.getArticle=id=> this.articles.find(item=>item.id===id);
this.getArticleByFolder=folder=> this.articles.find(item=>item.folder===folder);
this.getArticleText=id=>{
	const article=this.articles.find(item=>item.id===id);
	if(!article) throw new Error("article with id "+id+", dont exist!");
	const file=blogArticlesDir+article.folder+"/"+article.articleFile;
	return readFileAsync(file,"utf-8");
}
this.executeBlogArticleCode=async(id)=>{
	const rawArticleText=await this.getArticleText(id);
	let index=0;
	let staticData=true;
	let articleTextFunction="(async function(article,data,globals,log){let res='';";
	while(index<rawArticleText.length){
		const text=rawArticleText.substring(index);
		if(staticData){ // now we in text chunk
			const indexEnd=text.indexOf("<?");
			if(indexEnd===-1){
				articleTextFunction+="res+='"+string_codify(text)+"';";
				index=rawArticleText.length;
			}
			else{
				articleTextFunction+="res+='"+string_codify(text.substring(0,indexEnd))+"';";
				staticData=false;
				index+=indexEnd+2;
			}
		}
		else if(!staticData){ // now we in code chunck
			let dynamicValue=false;
			if(text.substring(0,1)==="=") dynamicValue=true;
			const indexEnd=text.indexOf("?>");
			if(indexEnd===-1){
				if(!dynamicValue) articleTextFunction+=string_codify(text);
				else if(dynamicValue) articleTextFunction+="res+=''+"+text.substring(1)+";";
				articleTextFunction+='res+="<hr>HEY YOU FORGOT ?&gt; at the end!");';
				index=rawArticleText.length;
				staticData=true;
			}
			else{
				if(!dynamicValue) articleTextFunction+=text.substring(0,indexEnd);
				else if(dynamicValue) articleTextFunction+="res+="+text.substring(1,indexEnd)+";";
				index+=indexEnd+2;
				staticData=true;
			}
		}
	}
	articleTextFunction+="return res;});";

	let articleText='';
	let articleFunction;
	const article=this.getArticle(id);
	try{
		articleFunction=eval(articleTextFunction);
	}catch(e){
		log("error building function: "+e);
		throw e;
	}
	try{
		const media="/blog/get/"+article.id+"/";
		const data=(type,...args)=>{
			if(type==="img"||type==="image"){
				const dataTemplate={
					alt: null,
					clickable: true,
				}
				let [src,data]=args;
				data={...dataTemplate,...data};
				let {clickable,alt}=data;

				if(!alt) alt=src;
				src=media+src;
				src=src.includes(" ")||src.includes("=")?('"'+src+'"'):src;
				alt=alt.includes(" ")||alt.includes("=")?('"'+alt+'"'):alt;
				let result='';
				result+="<p>";
				if(clickable) result+=`<a target=_blank href=${src}>`
				result+=`<img loading=lazy class=media src=${src}${data.alt?(' alt='+alt):''}>`;
				if(clickable) result+=`</a>`;
				result+="</p>";
				return result;
			}
		}
		articleText=await articleFunction(article,data,globals,a=>log_o("blog/"+article.folder+": "+a));
	}
	catch(e){
		log("error executeing blog article text code: "+e);
		throw e;
	}

	return articleText;
}
this.articleTemplate={
	id: undefined,
	created: undefined,
	lastEdit: undefined,
	title: null,
	description: null,
	folder: null,
	files:[],
	articleFile: null,
	visibility: "everyone",
	//writtenByUser: "lff",
};
this.getArticleTemplate=(article={})=>{
	const now=Date.now();
	return {
		...this.articleTemplate,
		id: now,
		created: now,
		lastEdit: now,
		...article,
	};
}
this.getSavedArticle=()=> this.savedArticle;
this.setSavedArticle=article=>{
	this.savedArticle=article;
	this.saveRequired=true;
};
this.addFileToSavedArticle=async(name,buffer)=>{
	log("Upload: "+blogArticlesDir+"saved/"+name);
	if(this.savedArticle.files.includes(name)) throw new Error("file already exists!");
	await createDirAsync(blogArticlesDir+"saved");
	await writeFileAsync(blogArticlesDir+"saved/"+name,buffer);
	this.savedArticle.files.push(name);
	this.saveRequired=true;
}
this.removeFileFromSavedArticle=file=>{
	log("DEL: "+blogArticlesDir+"saved/"+file);
	if(!this.savedArticle.files.includes(file)) throw new Error("file "+file+" not exist!");
	this.savedArticle.files=this.savedArticle.files.filter(item=>item!==file);
	this.saveRequired=true;
	return rmFileAsync(blogArticlesDir+"saved/"+file);
}

this.save=async required=>{
	if(this.saveRequired===true||required===true){
		log("saving "+this.articles.length+" articles to file.");
		await saveBlogArticlesFile();
		await saveSavedArticleFile();
		this.saveRequired=false;
		log("saved!");
	}
}

this.stop=async()=>{
	clearInterval(this.saveInterval);
	await this.save(true);
}
