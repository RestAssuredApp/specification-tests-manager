const FileTree = require("./filetree.js");
const Git = require("./git.js");

const privateKey = process.env.GIT_PRIVATEKEY;
const owner = process.env.GIT_OWNER;

const fileTree = new FileTree({ dirPath: __dirname, pathName: "stage" });
const git = new Git({ fileTree, privateKey, owner });

fileTree.build(true);