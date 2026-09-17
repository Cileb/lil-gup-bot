//pulling in secrets & libraries
require("dotenv").config();

//used to scan commands folder and register into commands collection
const fs = require("node:fs")
const path = require("node:path")

//pulling commands out of discord package, grabbing discord bot auth token
const {Client, Collection, GatewayIntentBits, Events} = require("discord.js");
const TOKEN = process.env.DISCORD_TOKEN;

//bot object creation
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

//attaching a new collection to the client object (will host commands)
client.commands = new Collection();

//loading commands folder into collection
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`)
    } else {
        console.warn(`Skipped ${file}: missing "data" or "execute".`);
    }
}

//connecting to server
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag} (ID: ${readyClient.user.id})`)
});

//executing a command, anytime an interaction is triggered (slash command, button click, dropdown selection, etc.)
//async - needs to await response from discord
client.on(Events.InteractionCreate, async (interaction) => {

    //checking if slashCommand or not
    if (!interaction.isChatInputCommand()) return;

    //looks up command, based off user input, matches to command in collection
    const command = client.commands.get(interaction.commandName);
    if(!command){
        console.warn(`No command matching ${interaction.commandName} was found`);
        return;
    }
    //tries to executes the script from the command in collection
    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        const errorReply = { content: "There was an error running that command.", ephemeral: true}; //only user who runs the command sees the error (ephemeral)
        if (interaction.replied || interaction.deferred){
            await interaction.followUp(errorReply);
        }
        else{
            await interaction.reply(errorReply)
        }
    }
})


//check if token exists, login
if(!TOKEN){
    throw new Error("DISCORD_TOKEN not set. Copy .env.example to .env and add your bot token.")
}
client.login(TOKEN)