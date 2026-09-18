//pulling in secrets & libraries
require("dotenv").config();

//used to scan commands folder and register into commands collection
const fs = require("node:fs")
const path = require("node:path")

//pulling commands out of discord package, grabbing discord bot auth token
const {Client, Collection, GatewayIntentBits, Events, ButtonBuilder, ButtonStyle, ActionRowBuilder} = require("discord.js");
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

//announcement temp storage
const pendingAnnouncements = new Map();

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
    if (interaction.isChatInputCommand()){

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
}   else if (interaction.isModalSubmit()){ /*modal input logic, gathering data from announce and posting message in channel*/
    if(interaction.customId === "announcement"){
        const message = interaction.fields.getTextInputValue("messageInput");
        const channels = interaction.fields.getSelectedChannels("channelSelect", true)
        const targetChannel = channels.first();
        const roles = interaction.fields.getSelectedRoles("roleSelect", false);
        const role = roles && roles.size > 0 ? roles.first() : null;

        pendingAnnouncements.set(interaction.user.id, {
            message,
            channelId: targetChannel.id,
            roleId: role ? role.id : null
        })

        const postNowButton = new ButtonBuilder()
        .setCustomId("announce_post_now")
        .setLabel("Post Now")
        .setStyle(ButtonStyle.Primary);

        const scheduleButton = new ButtonBuilder()
        .setCustomId("announce_schedule")
        .setLabel("Set Up Recurring Schedule")
        .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(postNowButton, scheduleButton);

        await interaction.reply({
            content: `Ready to post in ${targetChannel}${role ? ` (pinging ${role})` : ""}:\n\n${message}`,
            components: [row],
            ephemeral: true
        })

    }
}   else if (interaction.isButton()){
    if(interaction.customId === "announce_post_now"){
        const pending = pendingAnnouncements.get(interaction.user.id);
        if(!pending){
            await interaction.update({
                content: "This announcement setup has expired. Please run /announce again.",
                components: [],
            });
        return;
        }

        const channel = await interaction.guild.channels.fetch(pending.channelId);
        const roleMention = pending.roleId ? `<@&${pending.roleId}>` : "";
        const announcementText = `${roleMention}\n${pending.message}`;

        await channel.send(announcementText);
        pendingAnnouncements.delete(interaction.user.id);

        await interaction.update({
            content: `Announcement posted in ${channel}.`,
            components: [],
        })

    }


}})


//check if token exists, login
if(!TOKEN){
    throw new Error("DISCORD_TOKEN not set. Copy .env.example to .env and add your bot token.")
}
client.login(TOKEN)