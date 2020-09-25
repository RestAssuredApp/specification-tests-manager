const FileTree = require("./filetree.js");
const Git = require("./git.js");
const Trello = require("trello");
const fs = require("fs");
const logging = require("logging");

logging.config.add("Specification Tests Manager");

const componentRequestHandler = require("component.request.handler");
const componentDelegate = require("component.delegate");
const utils = require("utils");
const privatePort = process.env.PORT || 3000;
const publicHost = process.env.publicHost || "localhost";
const publicPort = process.env.publicPort || 3000;
let { trelloApplicationId, trelloToken, gitPrivateKey, trelloMemberId } = process.env;

(async () => {

    logging.write("Specification Tests Manager",`starting specification test manager`);

    await componentDelegate.register(`component.request.handler.route`, publicPort, async (request) => {

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
            if (trelloApplicationId && trelloToken && gitPrivateKey && trelloMemberId){
                logging.write("Specification Tests Manager",`hosted environment is setup correctly`);
                const trello = new Trello(trelloApplicationId, trelloToken);
                let response = {};
                const boardLists = (await Promise.all((await trello.getBoards(trelloMemberId)).map(async (x) => { 
                    return (await trello.getListsOnBoard(x.id)).map(y => { return { boardId: x.id, boardName: x.name, listId: y.id, listName: y.name } } )
                })))[0];

                let generateListCards = [];
                let runningListCards = [];
                let failingListCards = [];

                const generateListIds = boardLists.filter(x=>x.listName === "Generate Specification Tests");
                if (generateListIds && generateListIds.length > 0){
                    generateListCards =  (await Promise.all( await (await generateListIds.map( async x => await trello.getCardsForList(x.listId) )).map( x => x.idChecklists )))[0];
                }

                const runningListIds = boardLists.filter(x=>x.listName === "Running Specification Tests");
                if (runningListIds && runningListIds.length > 0){
                    runningListCards =  (await Promise.all(await runningListIds.map( async x => await trello.getCardsForList(x.listId) )))[0];
                }

                const failingListIds = boardLists.filter(x=>x.listName === "Failing Specification Tests");
                if (failingListIds && failingListIds.length > 0){
                    failingListCards =  (await Promise.all(await failingListIds.map( async x => await trello.getCardsForList(x.listId) )))[0];
                }

                response = utils.getJSONString({
                    generateListCards,
                    runningListCards,
                    failingListCards
                });

                // let gitOwnerTrelloUser = boardMemebers.find(x=>x.fullName.toLowerCase() === gitOwner.toLowerCase());
                // if (gitOwnerTrelloUser) {
                //     const trelloMemberId = gitOwnerTrelloUser.id;
                //     const boards = await trello.getBoards(trelloMemberId);

                //     boards

                //     response = utils.getJSONString(boards);
                // }

                return {
                    statusMessage: "Success",
                    statusCode: 200,
                    headers: {"Content-Type": "application/json"},
                    data: response
                };

                // 

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