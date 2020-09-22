const FileTree = require("./filetree.js");
const Git = require("./git.js");
const Trello = require("trello");
const fs = require("fs");
const logging = require("logging");

logging.config.add("Specification Tests Manager");

const componentRequestHandler = require("component.request.handler");
const componentDelegate = require("component.delegate");
const privatePort = process.env.PORT || 3000;
const publicHost = process.env.publicHost || "localhost";
const publicPort = process.env.publicPort || 3000;
const { gitOwner, trelloApplicationId, trelloToken, gitPrivateKey, trelloBoardId } = process.env;

(async () => {

    logging.write("Specification Tests Manager",`starting specification test manager`);

    await componentDelegate.register(`component.request.handler.route`, privatePort, async (request) => {

        logging.write("Specification Tests Manager",`handling request for ${request.path}`);

        if (request.path === "/"){
            logging.write("Specification Tests Manager",`Serving Root HTML`);
            const html = fs.readFileSync("./index.html","utf8")
            return {
                statusMessage: "Success",
                statusCode: 200,
                headers: {"Content-Type": "text/html"},
                data: html
            };
        }

        if (request.path === "/sync"){
            if (gitOwner && trelloApplicationId && trelloToken && gitPrivateKey && trelloBoardId){
                logging.write("Specification Tests Manager",`hosted environment is setup correctly`);
                //const trello = new Trello(trelloApplicationId, trelloToken);

                return {
                    statusMessage: "Success",
                    statusCode: 200,
                    headers: {"Content-Type": "text/plain"},
                    data: "Trello Connected"
                };

                // const boardId = 

                // trello.getListsOnBoard();

                // const myListId = "5f4cece36fedde06444688a4";
                // trello.addCard('Clean car', 'Wax on, wax off', myListId, (error, trelloCard) => {
                //     if (error) {
                //         console.log('Could not add card:', error);
                //     }
                //     else {
                //         console.log('Added card:', trelloCard);
                //     }
                // });
            } else {
                logging.write("Specification Tests Manager",`hosted environment is not setup correctly`);
                return {
                    statusMessage: "Internal Server Error",
                    statusCode: 500,
                    headers: {"Content-Type": "text/plain"},
                    data: "hosted environment is not setup correctly"
                };
            }
        }
        logging.write("Specification Tests Manager",`no matching request paths`);
        return {
            statusMessage: "Not Found",
            statusCode: 404,
            headers: {"Content-Type": "text/plain"},
            data: "path does not exist"
        };
    });
    await componentRequestHandler.handle({ publicHost, publicPort, privatePort });
    
    // const fileTree = new FileTree({ dirPath: __dirname, pathName: "stage" });
    //const git = new Git({ fileTree, privateKey, owner });
    //await git.load();
    //fileTree.build(true);

})().catch((err) => { throw err; });