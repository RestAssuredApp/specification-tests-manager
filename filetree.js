const fs = require("fs");
const pathHelper = require("path");
module.exports = function FileTree({ dirPath, pathName, ignoreDirectoryNames }) {
	
	this.modified = false;
	this.deleted = false;
	this.created = false;
	this.locked = false;
	this.path = pathHelper.join(dirPath, pathName);
	this.time = null;
	
	let children = [];
	let watches = [];	
	this.depth = 0;
	
	let _onFileChange = async()=>{
		console.log(`callers have not subscribed to the file change events for the ${pathName} file tree.`);
	}

	this.onFileChange = (callback) => {
		_onFileChange = callback;
	};

	this.reset=async()=>{
		children = [];
		for(const watch of watches){
			watch.close();
		};
	};

	this.build=(createDir, recurse)=>{
		if (fs.existsSync(this.path)){
			this.ext = pathHelper.extname(this.path) || "";
			this.id = getTreeId(this.path);
			this.stats = fs.statSync(this.path);
			this.name = pathName.replace(this.ext,"").replace(".","");
			if (this.stats.isDirectory()===true){
				if (recurse === false && this.depth >= 1){
					return;	
				}
				for(const _pathName of fs.readdirSync(this.path)) {
					const childTree = new FileTree({ dirPath: this.path, pathName: _pathName, fs, pathHelper, ignoreDirectoryNames });
					childTree.depth = this.depth + 1;
					childTree.build(false, recurse);
					const isIgnoredDirectory = ignoreDirectoryNames? (ignoreDirectoryNames.findIndex(dirName => dirName === childTree.name 
																		&& childTree.stats.isDirectory()) > -1): false;
					if (isIgnoredDirectory === false){
						children.push(childTree);
					}
				};
			}
		} else if (createDir===true) {
			fs.mkdirSync(this.path);
			this.build(false, recurse);
		}
	};

	this.watch=async()=>{

		console.log("");
		console.log("-------------------------------------------------------------------------------------------");
		console.log("STARTING WATCH");
		console.log("-------------------------------------------------------------------------------------------");
		
		const onWatchEvent = async(parentTreeFile, _pathName)=>{
			let treeFile = parentTreeFile.search(pathHelper.join(parentTreeFile.path, _pathName))[0];
			if (treeFile){

				if (treeFile.locked === false){
					treeFile.locked = true;
					if (treeFile.stats.isFile()){
						if (fs.existsSync(treeFile.path)===true) {
							treeFile.modified = true;
						}else{
							treeFile.deleted = true;
						}
						await _onFileChange();
						treeFile.created = false;
						treeFile.modified = false;
						treeFile.deleted = false;
					}
					setTimeout(()=>{
						treeFile.locked = false;
					},10);
					treeFile.time =(new Date()).getTime();
				}

			} else {

				console.log("adding new file to the FileTree");
				
				treeFile = new FileTree({ dirPath: parentTreeFile.path, pathName: _pathName, fs, pathHelper, ignoreDirectoryNames });
				treeFile.build();
				parentTreeFile.add(treeFile);
				
				treeFile.locked = true;
				treeFile.created = true;
				
				await _onFileChange();

				treeFile.locked = false;
				
				treeFile.modified = false;
				treeFile.deleted = false;
				treeFile.created = false;

				treeFile.time =(new Date()).getTime();
			}
		}

		console.log(`watching ${this.path}...`);
		let watcher = await fs.watch(this.path,async(type, file) => {
			await onWatchEvent(this, file);
		});
		watches.push(watcher);
		for(const treeItem of children) {
			if (treeItem.stats.isDirectory()){
				let watchDir =  treeItem.path;
				console.log(`watching ${watchDir}.`);
				watcher = await fs.watch(watchDir, async(type, file) => {
					await onWatchEvent(treeItem, file);
				});
				watches.push(watcher);
			}
		};
		console.log("-------------------------------------------------------------------------------------------");
	};

	this.getContent=()=>{
		return fs.readFileSync(this.path, "utf8");
	}

	this.add=(child)=>{
		children.push(child);
	}

	this.search=(filter)=>{
		let results = [];
		for(const treeItem of children){
			const fileNameExt =  `${treeItem.name}${treeItem.ext}`;
			if (filter && typeof filter === "object"){
				for(const keyName of Object.keys(filter)){
					const expectedKeyValue = filter[keyName];
					const actualKeyValue = treeItem[keyName];
					if (actualKeyValue === expectedKeyValue){
						results.push(treeItem);
					}
				};
			} else if (filter && typeof filter === "string" && (treeItem.name === filter || treeItem.ext === filter || fileNameExt === filter || treeItem.path.startsWith(filter) === true)){
				results.push(treeItem);
			} else if (filter && typeof filter === "string" && filter === "*") {
				results.push(treeItem);
			}
			results = results.concat(treeItem.search(filter));
		};
		return results;
	}

	const getTreeId = (path) => {
		return path.replace(/[\/\.\\:]+/g,"");
	};
};