const Discord = require("discord.js");
const client = new Discord.Client();

var confToken = 'NTQ5MjEzNTY4NDg3MTI5MDk5.XKFAtQ.TlHAJg0yY3pScK8SMMcDXP42Hwo';

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("guildCreate", guild => {
    console.log(`Joined server ${guild.id}`);
});

client.on("messageReactionAdd", (msgReact, user) => {
    var msg = msgReact.message;
    
    if (msgReact.emoji.name == '\u26AA') {
        msg.react('\u26AA');
        sendMessage(msg.guild, msg.content + "\r\n\r\nhttps://discordapp.com/channels/" + msg.guild.id + "/" + msg.channel.id + "/" + msg.id);
    }
});

client.login(confToken);

function sendMessage(server, message) {
    for(entry of server.channels) {
        var channel = entry[1];
        if (channel.type == "text" && channel.name == "feed") {
            channel.send(message);
            return;
        }
    }
    console.log("COULDNT FIND #feed IN " + serverId + " (" + client.guilds.get(serverId).name + ")");
}
