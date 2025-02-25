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
	tofsStr,
}=globals.functions;

const getDateUpsideDown=(date=new Date(),sub=".")=> date.getFullYear()+sub+String(date.getMonth()+1).padStart(2,0)+sub+String(date.getDate()).padStart(2,0);
const getTimeUpsideDown=(date=new Date,sub=":")=> String(date.getHours()).padStart(2,0)+sub+String(date.getMinutes()).padStart(2,0);

const loadBlogArticlesFile=async()=>{
	log("Load: "+blogArticlesFile);
	const articles=await readJsonFileAsync(blogArticlesFile);
	if(!articles) this.articles=[];
	else this.articles=articles;
}
const saveBlogArticlesFile=()=>{
	if(this.articles.length===0){
		log("dont save empty file: "+blogArticlesFile);
		return rmFileAsync(blogArticlesFile);
	}
	else{
		log("Save: "+blogArticlesFile);
		return writeJsonFileAsync(blogArticlesFile,this.articles);
	}
}

const saveSavedArticleFile=async()=>{
	const article=this.savedArticle;
	if(JSON.stringify(article)===JSON.stringify(this.getArticleTemplate())){
		log("dont save empty file: "+blogArticlesDir+"saved/article.json");
		return rmFileAsync(blogArticlesDir+"saved/article.json");
	}
	else{
		log("Save: "+blogArticlesDir+"saved/article.json");
		await createDirAsync(blogArticlesDir+"saved");
		await writeJsonFileAsync(blogArticlesDir+"saved/article.json",article);
	}
}
const loadSavedArticleFile=async()=>{
	log("Load: "+blogArticlesDir+"saved/article.json");
	const article=await readJsonFileAsync(blogArticlesDir+"saved/article.json");
	if(!article) this.savedArticle=this.getArticleTemplate();
	else this.savedArticle=article;
}

this.start=async()=>{
	await createDirAsync("data/blog"); // erstellen des "blog" ordners im daten speicher!
	
	await loadBlogArticlesFile();
	await loadSavedArticleFile();
}

this.createArticle=async(article,articleText=null)=>{
	article=this.getArticleTemplate(article);
	const articleCreatedDate=new Date(article.created);
	if(!article.title||!article.description) throw new Error("blog article not have description or title, but its required!");
	if(!articleText&&(!article.folder||!article.articleFile)) throw new Error("blog article is not given!");

	if(!article.folder){
		article.folder=getDateUpsideDown(articleCreatedDate,"-")+"_"+getTimeUpsideDown(articleCreatedDate,"-");
		await createDirAsync(blogArticlesDir+article.folder);
	}
	if(!article.articleFile&&article.articleText){
		article.articleFile=defaultBlogFileName;
		await writeFileAsync(blogArticlesDir+article.folder+"/"+defaultBlogFileName,articleText);
	}
	this.articles.push(article);
	this.saveRequired=true;
}
this.editArticle=(article,articleText=null)=>{
	article={
		...article,
		...this.getArticle(article.id),
	};
	const articleIndex=this.articles.findIndex(item=>item.id===article.id);
	if(articleIndex===-1) throw new Error("article not found");

	log("edit Article (Attr) '"+article.title+"'");
	this.articles[articleIndex]=article;
	this.saveRequired=true;

	if(articleText){
		log("edit Article (Text) '"+article.title+"',saving...");
		const file=blogArticlesDir+articles.folder+"/"+article.articleFile;
		return writeFileAsync(file,articleText);
	}
}

this.getArticles=()=>this.articles;
this.hasArticle=id=> this.articles.some(item=>item.id===id);
this.getArticle=id=> this.articles.find(item=>item.id===id);
//this.getArticleByFolder=folder=> // später eine suche machen wo man suchen kann anhand von datums etc
this.getArticleText=id=>{
	const article=this.articles.find(item=>item.id===id);
	if(!article) throw new Error("article with id "+id+", dont exist!");
	const file=blogArticlesDir+article.folder+"/"+article.articleFile;
	return readFileAsync(file,"utf-8"); // returns promise object
}
this.getArticleTemplate=(article={})=>{
	const now=Date.now();
	return {
		id: now,
		created: now,
		lastEdit: now,
		title: null,
		description: null,
		folder: null,
		files:[],
		articleFile: null,
		visibility: "everyone",
		//writtenByUser: "lff",
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
	console.log(this.savedArticle.files);
	this.savedArticle.files=this.savedArticle.files.filter(item=>item!==file);
	this.saveRequired=true;
	console.log(this.savedArticle.files);
	return rmFileAsync(blogArticlesDir+"saved/"+file);
}

this.save=async required=>{
	if(this.saveRequired===true||required===true){
		log("saving "+this.articles.length+" articles to file.");
		await saveBlogArticlesFile();
		await saveSavedArticleFile();
		this.saveRequired=false;
	}
}

this.stop=async()=>{
	await this.save(true);
}
