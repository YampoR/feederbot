const Discord = require("discord.js");
const client = new Discord.Client();

var confToken = 'NTQ5MjEzNTY4NDg3MTI5MDk5.XKFAtQ.TlHAJg0yY3pScK8SMMcDXP42Hwo';

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}. version 2.1!`);
});

client.on("guildCreate", guild => {
    console.log(`Joined server ${guild.id}`);
});

client.on("messageReactionAdd", (msgReact, user) => {
    var msg = msgReact.message;
    if (msgReact.emoji.name == '\u26AA' && msgReact.count == 1 && user.id != msg.author.id && user.id !== client.user.id) {
        msg.react('\u26AA');
        msgReact.remove(user);
        sendEmbed(msg.guild, msg);
    }
});

client.login(confToken);

function sendEmbed(server, msg) {
    for(entry of server.channels) {
        var channel = entry[1];
        if (channel.type == "text" && channel.name == "feed") {
            var embed = new Discord.RichEmbed();
            embed.setAuthor(msg.member.displayName, msg.author.avatarURL);
            embed.setDescription(msg.content);
            var url = "https://discordapp.com/channels/" + msg.guild.id + "/" + msg.channel.id + "/" + msg.id;
            embed.setTitle('Message in #' + msg.channel.name);
            channel.send(url, embed);
            return;
        }
    }
    console.log("COULDNT FIND #feed IN " + serverId + " (" + client.guilds.get(serverId).name + ")");
}
