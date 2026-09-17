require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

//REST - direct HTTP requests to Discord's API
const {REST, Routes} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

//scanning commands folder, sending commands to Discord's API
const commands = []; //collection not needed here, handing over a flat list to Discord
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));


for (const file of commandFiles){
    const command = require(path.join(commandsPath, file));
    if("data" in command){
        commands.push(command.data.toJSON()); //convert JSObject to JSON data, pushes to array
    }
}

//talking to discord, creating REST client
const rest = new REST().setToken(TOKEN);


//async IIFE, allows us to use await and triggers instantly
(async () => { 
    try{
        console.log(`Registering ${commands.length} commands(s)...`);

        const data = await rest.put( //put command will overwrite whatever is there currently with commands folder
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log(`Successfully registered ${data.length} commands(s).`)
    }
    catch (error){
        console.error(error);
    }
})();

