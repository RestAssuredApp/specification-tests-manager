const fs = require("fs");
const pathHelper = require("path");

const { Octokit } = require("@octokit/rest");
const { App } = require("@octokit/app");

const OctokitApp = App;
const OctokitRest = Octokit;

module.exports = function ({ fileTree, privateKey, owner }) {
    
    const wrapOctokitResponse=async(octokitCommandQuery)=>{
      let items = [];
      const response = await octokitCommandQuery;
      if (Array.isArray(response.data)===false){
        items = [response.data];
      } else {
        items = response.data;
      }
      return items;
    };
  
    const getPullRequests = async(sourceBranch, destinationBranch)=>{
      let pullRequests = await wrapOctokitResponse(octokit.pulls.list({ owner, repo }));
      if (pullRequests){
        return pullRequests.filter(x=>x.base.ref === destinationBranch && x.head.ref === sourceBranch && x.state === "open");
      } else {
        return [];
      }
    };
  
    const getFilesMetadata = async(branch) => {
      
      const gitFiles = [];
      const branchMetadata = await getBranchFileMetadata(branch);
      
      for(const branchFileMetadata of branchMetadata){
        const expectedPath = pathHelper.join(fileTree.path, branchFileMetadata.path);
        const isGitFile = (branchFileMetadata.type === "file");
        const foundFile = fileTree.search(expectedPath)[0];
        if (foundFile){
          gitFiles.push({
            isOnDisk: true,
            isInRepo: true, //if there is git metadata then this is always true.
            path: expectedPath,
            isFile: foundFile.stats.isFile(),
            sizeDiff: (foundFile.stats.size - branchFileMetadata.size),
            sha: branchFileMetadata.sha,
            deletedFromDisk: foundFile.deleted
          });
        } else {
           gitFiles.push({
            isOnDisk: false,
            isInRepo: true, //if there is git metadata then this is always true.
            path: expectedPath,
            isFile: isGitFile,
            sizeDiff: 0, //if file is not on disk we don't care about doing diffs
            sha: branchFileMetadata.sha,
            deletedFromDisk: false
          });
        }
      };
  
      for (const file of  fileTree.search("*")){
        const isFileInGitRepo = gitFiles.find(x=>x.path === file.path)!==undefined;
        if (isFileInGitRepo === false){
          gitFiles.push({
            isOnDisk: true,
            isInRepo: false,
            path: file.path,
            isFile: file.stats.isFile(),
            sizeDiff: 0, //if file is not in git we don't care about doing diffs
            sha: null,
            deletedFromDisk: file.deleted
          });
        }
      };
      
      return gitFiles;
    };
  
    const getBranchFileMetadata=async(branchName, searchPath)=>{
      const filesMetadata = (await octokit.repos.getContents({ owner, repo, path: searchPath? searchPath: "" , ref: `refs/heads/${branchName}`})).data;
      let fileMetadata=[];
      for(const metadata of filesMetadata){
        if (metadata.type === "dir") {
          fileMetadata.push({path: metadata.path, sha: metadata.sha, type: metadata.type, isFile: false, size: metadata.size });
          fileMetadata = await fileMetadata.concat(await getBranchFileMetadata(branchName, metadata.path));
        } else if (metadata.type === "file" ) {
          fileMetadata.push({path: metadata.path, sha: metadata.sha, type: metadata.type, isFile: true, size: metadata.size });
        }
      };
      return fileMetadata;
    }
  
    const getBranches = async()=> {
      return await Promise.all((await wrapOctokitResponse(octokit.git.listMatchingRefs({ owner, repo }))).filter(x=>x.object.type === "commit").map(async(x)=>{
        return (await wrapOctokitResponse(octokit.git.getCommit({ owner, repo, commit_sha: x.object.sha }))).reduce((obj, commit)=>{
          obj.name = x.ref.replace("refs/heads/","");
          obj.sha = commit.sha;
          obj.message = commit.message;
          obj.ref = x.ref;
          return obj;
        },{});
      }));
    }
  
    const ensureBranch=async(branchName) => {
      const branches = await getBranches();
      const masterBranch = branches.find(x=>x.name === "master");
      if (branches.find(x=>x.name === branchName)){
        console.log(`${branchName} git branch already exists.`)
      } else {
          console.log(`creating the ${branchName} branch...`)
          await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: masterBranch.sha });
          console.log(`${branchName} branch created.`)
      }
    }
  
    let gitRequestsLock = false;
    const getGitRequestsLock = async () => {
      if (gitRequestsLock===true){
        await setTimeout(getGitRequestsLock, 1000);
      }
      if (gitRequestsLock===false){
        gitRequestsLock = true;
      }
    }

    let octokit;
    let repo;
    
    this.load = async () => {

      const app = new OctokitApp({ id: 29633, privateKey });
      const token = await app.getInstallationAccessToken({ installationId: 869338 });
      octokit = new OctokitRest({ auth: token });
      
      const branch = fileTree.name;
      repo = fileTree.name;
  
      await getGitRequestsLock();
  
      console.log("");
      console.log("-------------------------------------------------------------------------------------------");
      console.log(`LOADING THE ${fileTree.name} REPOSITORY.`);
      console.log("-------------------------------------------------------------------------------------------");
     
      await ensureBranch(branch);
  
      const mergeBranchName = `${branch}_merge`;
      await ensureBranch(mergeBranchName);
  
      for(const pull of (await getPullRequests(mergeBranchName, branch))){
        await octokit.pulls.merge({ owner, repo, pull_number: pull.number });
      };
      
      let remoteMergeBranchChanges = false;
      for(const fileMetadata of (await getFilesMetadata(branch)) ) {
  
        const gitPath = fileMetadata.path.replace(fileTree.path,"").replace(/\\/g,"/").replace("/","");
  
        if (fileMetadata.isOnDisk===false){
  
          if (fileMetadata.isFile === true){
            if (fileMetadata.isInRepo === true){
              if (fileMetadata.deletedFromDisk === true){
                  console.log(`deleting ${gitPath} in the ${mergeBranchName} branch.`);
                  await octokit.repos.deleteFile({ owner, repo, path:  gitPath, branch: mergeBranchName,
                      message: `deleted ${gitPath} in the ${mergeBranchName} branch.`, 
                      sha: fileMetadata.sha
                  });
                  remoteMergeBranchChanges = true;
              } else {
                const response =  await octokit.gitdata.getBlob({ owner, repo: fileTree.name, file_sha: fileMetadata.sha, ref: mergeBranchName });
                if(response.status===200){
                  const buff = new Buffer(response.data.content, 'base64');
                  fs.writeFileSync(fileMetadata.path, buff.toString('ascii'));
                  console.log(`created ${fileMetadata.path}.`);
                }
              }
            } else {
              throw new Error("metadata indicated that there is file that is not on disk therefor it needs to download it from git, but the file is not in git.");
            }
          } else {
            fs.mkdirSync(fileMetadata.path);
          }
  
        } else if (fileMetadata.isFile === true) {
          if (fileMetadata.isInRepo === true){
            if (fileMetadata.sizeDiff !== 0) {
              console.log(`updating ${gitPath} in the ${mergeBranchName} branch.`);
              await octokit.repos.updateFile({ owner, repo, path:  gitPath, branch: mergeBranchName,
                message: `updated ${gitPath} in the ${mergeBranchName} branch.`, 
                content: fs.readFileSync(fileMetadata.path,"base64"),
                sha: fileMetadata.sha
              });
              remoteMergeBranchChanges = true;
            }
          } else {
            console.log(`creating ${gitPath} in the ${mergeBranchName} branch.`);
            await octokit.repos.createFile({ owner, repo, path:  gitPath, branch: mergeBranchName,
              message: `created ${gitPath} in the ${mergeBranchName} branch.`, 
              content: fs.readFileSync(fileMetadata.path,"base64")
            });
            remoteMergeBranchChanges = true;
          }
        }
      };
  
      if (remoteMergeBranchChanges === true){
        console.log(`merging ${mergeBranchName} into ${branch}`);
        await octokit.pulls.create({owner, repo, title:"auto pull request created by container", head: mergeBranchName, base: branch, maintainer_can_modify: true});
        console.log(`${mergeBranchName} merged into ${branch}`);
        for(const pull of (await getPullRequests(mergeBranchName, branch))){
          await octokit.pulls.merge({ owner, repo, pull_number: pull.number });
        };
        remoteMergeBranchChanges = false;
      } else {
        console.log(`no changes were found in the ${mergeBranchName} branch.`);
      }
  
      gitRequestsLock = false;
    };
};