const FileTree = require("./filetree.js");
const Git = require("./git.js");
const Trello = require("trello");
const fs = require("fs");
const componentRequestHandler = require("component.request.handler");
const componentDelegate = require("component.delegate");

(async () => {
    await componentDelegate.register(`component.request.handler.route`, 3000, async (request) => {
        if (request.path === "/"){
            const html = fs.readFileSync("./index.html","utf8")
            return {
                statusMessage: "Success",
                statusCode: 200,
                headers: {"Content-Type": "text/html"},
                data: html
            };
        } else {
            const data = JSON.stringify(request.data);
            if (data && data.owner && data.gitPrivateKey && data.trelloApplicationId && data.trelloToken){
                const trello = new Trello(data.trelloApplicationId, data.trelloToken);
                const myListId = "5f4cece36fedde06444688a4";
                trello.addCard('Clean car', 'Wax on, wax off', myListId, (error, trelloCard) => {
                    if (error) {
                        console.log('Could not add card:', error);
                    }
                    else {
                        console.log('Added card:', trelloCard);
                    }
                });
            }
        }
    });
    await componentRequestHandler.handle({
        publicHost: "localhost",
        publicPort: 3000,
        privatePort: 3000
    });
    
    // const fileTree = new FileTree({ dirPath: __dirname, pathName: "stage" });
    //const git = new Git({ fileTree, privateKey, owner });
    //await git.load();
    //fileTree.build(true);

})().catch((err) => { throw err; });