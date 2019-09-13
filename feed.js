// Configuration
const Configuration = {

    General: {
        BotToken: 'NTQ5MjEzNTY4NDg3MTI5MDk5.XKFAtQ.TlHAJg0yY3pScK8SMMcDXP42Hwo',
        LogChannelId: '617405248587169798',
        Developers: [
            '146312749146701824' // @Xesau#1681
        ]
    },

    Feed: {
        Enabled: true,
        Channels: {
            '\u26AA': '562042082408005642', // :white_circle: -> #feed
            '\uD83D': '508676723273891840' // :red_circle: -> #Burgerwacht
        },
        AllowOwnMessages: false,
        BlockedChannels: [
            '527123966020550666', // #theorie
            '618226503347470336', // Zelforganisatie I
            '616400159483363338', // Zelforganisatie II
            '513002607439118336', // #polemiek / #oranje
        ]
    },

    MessageRestrictions: {
        Enabled: true,
        Messages: {
            MessageDeleted: 'Ik heb je bericht in {channel} verwijderd om de volgende reden(en):',
            ListIcon: ':small_orange_diamond: ',
            TooShort: 'Je bericht is korter dan {length} tekens, de minimale lengte in dit kanaal.',
            TooLong: 'Je bericht is langer dan {length} tekens, de maximale lengte in dit kanaal. Splits het op in meerdere stukken.',
            ContainsUrl: 'Je bericht bevat een link, wat niet toegestaan is in dit kanaal.'
        },
        Channels: {
            // #theorie
            '527123966020550666': {
                MinLength: 200,
                ExceptUrls: true
            }
        }
    },

    Commands: {
        Prefix: '!'
    },

    Zelforganisatie: {
        ApiUrl: 'https://www.hettuig.nl/bot',
        Enabled: true,
        RequiredRoleId: '506183228206481428',
        PublicAccessRoleId: '618406903738925056',
        RequiredPermissionsBaseChannelId: '618378693202673664',
        PublicAccessIcons: {
            true: ':white_circle:',
            false: ':red_circle:'
        },
        CategoryIds: [
            '618226503347470336', // Zelforganisatie I
            '616400159483363338', // Zelforganisatie II
        ],
        BannedOverwriteIds: [
            '506183228206481428', // Kameraden
            '600343301266210816', // Teller bot
            '621446162200789013', // Teller rol
            '547473949613621320', // Roller bot
            '621448632629067779', // Roller rol
            '507953128822407169', // Bots
            '506859867508572171', // Burgerwacht
            '511945889502461964', // Conservatieven
            '621446143812960277', // Liberalen
            '621446162200789013', // Brocialisten

        ],
        WelcomeMessage: 'Welkom in je eigen kanaal, {username}. Je kunt mensen toe voegen met !add @[persoon] en verwijderen met !remove @[persoon]. Zie #618422819298082829 voor meer informatie.'
    }
}

// Libraries
const Discord = require("discord.js");
const request = require("request");
const client = new Discord.Client();

// Patcher
let Patcher = {

    enableOldReactionListeners: function(client) {
        client.on("raw", async event => {
            let events = {
                MESSAGE_REACTION_ADD: 'messageReactionAdd',
                MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
            };
            if (!events.hasOwnProperty(event.t)) return;
            const { d: data } = event;
            const user = client.users.get(data.user_id);
            const channel = client.channels.get(data.channel_id) || await user.createDM();

            if (channel.messages.has(data.message_id)) return;

            const message = await channel.fetchMessage(data.message_id).catch(errorHandler);
            const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
            let reaction = message.reactions.get(emojiKey);

            if (!reaction) {
                const emoji = new Discord.Emoji(client.guilds.get(data.guild_id), data.emoji);
                reaction = new Discord.MessageReaction(message, emoji, 1, data.user_id === client.user.id);
            }

            client.emit(events[event.t], reaction, user);
        });
    }

};

// Feed
let Feed = {

    enable(client) {
        client.on("messageReactionAdd", (reaction, user) => {
            var message = reaction.message;
            var channel = message.channel;

            // If it was already feeded, skip
            if (reaction.users.has(client.user.id))
                return;

            // Ignore own reactions
            // TODO: TEST if redundant after previous
            if (user.id == client.user.id)
                return;

            // Blocked channels & categories
            if (Configuration.Feed.BlockedChannels.indexOf(channel.id) > -1
             || (channel.parent && Configuration.Feed.BlockedChannels.indexOf(channel.parent.id) > -1))
                return;

            // If blocked, Don't FEED your own messages
            if (!Configuration.Feed.AllowOwnMessages && (user.id == message.author.id && !isBotAdmin(message.guild.members.get(user.id))))
                return;

            // Check if reaction means anything
            if (!(reaction.emoji.name in Configuration.Feed.Channels))
                return;

            let feedChannelId = Configuration.Feed.Channels[reaction.emoji.name];
            let feedChannel = message.guild.channels.get(feedChannelId);
            if (typeof feedChannel == 'undefined') {
                errorHandler('Feed channel for ' + reaction.emoji.name + ' invalid (#' + feedChannelId + ')');
                return;
            }

            message.react(reaction.emoji).catch(errorHandler);
            reaction.remove(user).catch(errorHandler);
            var embed = new Discord.RichEmbed()
                .setAuthor(message.member.displayName, message.author.avatarURL)
                .setDescription(message.content)
                .setTitle('Message in #' + channel.name + ' pinned by ' + user.username);

            feedChannel.send(message.url, embed).catch(errorHandler);
            errorHandler('Pinned message by ' + message.author + ' in ' + message.channel);
        });
    }

}

// Commands
let Commands = {
    commands: {},

    enable(client) {
        client.on("message", (message) => {
            if (!message.guild)
                return;

            if (!message.content.startsWith(Configuration.Commands.Prefix))
                return;

            let fullCommand = message.content.substring(Configuration.Commands.Prefix.length);
            let args = fullCommand.split(/\s+/);
            let command = args.shift();
            if (!(command in Commands.commands))
                return;

            Commands.commands[command](message.guild, message.member, command, args, message);
        });
    },

    addCommand(commandName, handler) {
        Commands.commands[commandName] = handler;
    }
}

// Old command system
client.on("message", (message) => {
    if (!message.guild)
        return;

    if (!isBotAdmin(message.member))
        return;

    if (!message.content.startsWith("/")) {
        return;
    }

    let args = message.content.split(/\s+/);
    let command = args.shift();
    let guild = message.guild;

    // if (command == "/create_channels") {
        // if (args[0] == 'IAmVerySure') {
            // Zelforganisatie.Database.getUsers(async function(userIDs) {
                // let nSkip = 0;
                // let nDo = 0;
                // let role = guild.roles.get(KameraadRoleId);
                // for(member of role.members.array()) {
                    // // Create channel for members without channel
                    // if (userIDs.indexOf(member.user.id) == -1) {
                        // await Zelforganisatie.createChannel(member);
                        // nDo++;
                    // } else
                        // nSkip++;
                // }
                // message.author.send("Created channels for " + nDo + " " + role.name + " members, skipped for " + nSkip + " members").catch(errorHandler);
            // });
        // } else {
            // message.author.send('Are you sure you want to create a new channel for everyone without their own channel? If so, type **/create_channels IAmVerySure** in the server you want to execute this command in.');
        // }
    // }

    // else
        if (command == "/set_default_permissions") {
        if (!args) {
            return;
        }
        let ch = guild.channels.get(args[0]);
        Zelforganisatie.setDefaultPermissions(ch);
    }

    // else if (command == "/member_has_channel") {
        // if (!args.length) {
            // message.channel.send('Use /member_has_channel <@User>');
            // message.delete();
        // }
        // let member = message.mentions.members.first();
        // Zelforganisatie.Database.userHasChannel(member.id, function(has) {
            // message.author.send("Member " + member.user.username + " has " + (has ? 'a' : 'no') + ' channel.');
        // });
    // }

    // Unknown command
    else return;

    message.delete().catch(errorHandler);
});

// Zelforganisatie
let Zelforganisatie = {

    updatingChannels: {},

    isChannelPublic(channel) {
        if (!Configuration.Zelforganisatie.PublicAccessRoleId)
            return false;

        let overwrite = channel.permissionOverwrites.get(Configuration.Zelforganisatie.PublicAccessRoleId);
        if (!overwrite)
            return false;

        let permissions = new Discord.Permissions(overwrite.allow);
        return permissions.has('VIEW_CHANNEL');
    },

    enable(client, commands) {
        // Register event listeners
        client.on('channelDelete', (channel) => {
            Zelforganisatie.Database.deleteChannel(channel.id);
        });

        client.on("channelUpdate", async (oldChannel, newChannel) => {
            await Zelforganisatie.setDefaultPermissions(newChannel);
        });
        client.on("guildMemberUpdate", (oldMember, newMember) => {
            if ( oldMember.roles.has(Configuration.Zelforganisatie.RequiredRoleId)
             || !newMember.roles.has(Configuration.Zelforganisatie.RequiredRoleId))
                return;
            if (Zelforganisatie.Database.userHasChannel(newMember.id, (has) => {
                if (!has)
                    Zelforganisatie.createChannel(newMember);
            }));
        });

        // Register commands
        commands.addCommand('add', (g, u, c, a, m) => {
            Zelforganisatie.Database.getUserChannel(u.id, (channelId) => {
                if (typeof channelId == 'undefined') {
                    u.send('Je kunt kameraden alleen toevoegen aan je eigen kanaal.').catch(errorHandler);
                    return true;
                }
                let channel = g.channels.get(channelId);
                let addMember = m.mentions.users.first();
                if (typeof addMember == 'undefined') {
                    u.send('Het commando is: ' + Configuration.Commands.Prefix + 'add @gebruiker').catch(errorHandler);
                    return true;
                }
                channel.overwritePermissions(addMember, {
                    'VIEW_CHANNEL': true,
                    'SEND_MESSAGES': true,
                    'EMBED_LINKS': true,
                    'ATTACH_FILES': true,
                    'USE_EXTERNAL_EMOJIS': true,
                    'ADD_REACTIONS': true,
                    'READ_MESSAGE_HISTORY': true
                });
                u.send('Je hebt ' + addMember + ' toegevoegd aan ' + channel).catch(errorHandler);
                return true;
            });
        });
        commands.addCommand('remove', (g, u, c, a, m) => {
            Zelforganisatie.Database.getUserChannel(u.id, (channelId) => {
                if (typeof channelId == 'undefined') {
                    u.send('Je kunt kameraden alleen verwijderen uit je eigen kanaal.').catch(errorHandler);
                    return true;
                }
                let channel = g.channels.get(channelId);
                let removeMember = m.mentions.users.first();
                if (typeof removeMember == 'undefined') {
                    u.send('Het commando is: ' + Configuration.Commands.Prefix + 'remove @gebruiker').catch(errorHandler);
                    return true;
                }
                channel.overwritePermissions(removeMember, {
                    'VIEW_CHANNEL': false,
                    'SEND_MESSAGES': false
                });
                u.send('Je hebt ' + removeMember + ' verwijderd uit ' + channel).catch(errorHandler);
                return true;
            });
        });
        // commands.addCommand('reset', (g, u, c, a, m) => {
            // Zelforganisatie.Database.getUserChannel(u.id, (channelId) => {
                // if (typeof channelId == 'undefined') {
                    // u.send('Je hebt geen eigen kanaal waar je mensen aan toe kunt voegen.').catch(errorHandler);
                    // return true;
                // }
                // let channel = g.channels.get(channelId);
                // if (a.length == 1 && a[1] == 'IAmVerySure') {

                // } else
                    // u.send('Typ !reset IAmVerySure om je kanaal te resetten.').catch(errorHandler);
                // return true;
            // });
        // });
        commands.addCommand('zelforganisatie', (g, u, c, a, m) => {
            let subcommand = a.shift();
            if (!isBotAdmin(u))
                return;

            // Help
            if (!subcommand) {
                u.send('**!zelforganisatie**\n' +
                    '- !zelforganisatie create @member: Kanaal maken voor member\n' +
                    '- !zelforganisatie createAll: Kanaal maken voor iedereen met nodige rol zonder kanaal\n' +
                    '- !zelforganisatie channels [all|public]: Lijst met gebruikers en hun kanalen\n' +
                    '- !zelforganisatie cleanup: Database opschonen'
                ).catch(errorHandler);
                return true;
            }

            // /zelforganisatie assign
            if (subcommand == 'assign') {
                if (a.length != 2) {
                    u.send('Syntax: !zelforganisatie assign <userId> <channelId>');
                    return true;
                }
                let user = g.members.get(a[0]);
                let channel = g.channels.get(a[1]);
                u.send('Assigning ' + channel + ' to ' + user);
                Zelforganisatie.Database.setUserChannel(a[0], a[1]);
                return true;
            }

            // /zelforganisatie cleanup
            if (subcommand == 'cleanup') {
                Zelforganisatie.Database.getChannels(function(channels) {
                    g.fetchMembers().then(function() {
                        let nCleanupM = 0, nCleanupC = 0;
                        for(userID in channels) {
                            if (!g.members.has(userID)) {
                                Zelforganisatie.Database.deleteUserChannel(userID);
                                nCleanupM++;
                            }
                            else if (!g.channels.has(channels[userID])) {
                                Zelforganisatie.Database.deleteChannel(channels[userID]);
                                nCleanupC++;
                            }
                            continue;
                        }
                        u.send('Cleaned up ' + nCleanupM + ' members, ' + nCleanupC + ' channels').catch(errorHandler);
                    }).catch(errorHandler);
                });
                return true;
            }

            // /zelforganisatie create @member
            if (subcommand == 'create') {
                if (!a.length) {
                    u.send('Use /zelforganisatie create @User');
                    return true;
                }
                let newMember = m.mentions.members.first();
                Zelforganisatie.createChannel(newMember);
                return true;
            }

            // /zelforganisatie channels
            if (subcommand == 'channels') {
                let publicOnly = a.length && a[0] == 'public';
                Zelforganisatie.Database.getChannels(function(channels) {
                    g.fetchMembers().then(function() {
                        let buf = '**Lijst van ' + (publicOnly ? 'publieke ' : '') +
                            'zelforganisatie-kanalen:**\n';
                        for(userID in channels) {
                            let member = g.members.get(userID);
                            let channel = g.channels.get(channels[userID]);
                            if (typeof member == 'undefined' || typeof channel == 'undefined')
                                continue;
                            let channelPublic = Zelforganisatie.isChannelPublic(channel);
                            if (publicOnly && !channelPublic)
                                continue;
                            buf += Configuration.Zelforganisatie.PublicAccessIcons[channelPublic] +
                                member + ': ' + channel + "\n";
                            if (buf.length > 1800) {
                                u.send(buf).catch(errorHandler);
                                buf = '';
                            }
                        }
                        u.send(buf).catch(errorHandler);
                    }).catch(errorHandler);
                });
            }

            return false;
        });
    },

    async setDefaultPermissions(ch) {
        if (!ch.parent || !(Configuration.Zelforganisatie.CategoryIds.indexOf(ch.parent.id) > -1))
            return;

        if (Zelforganisatie.updatingChannels[ch.id])
            return;

        // Stop listening for this channel
        Zelforganisatie.updatingChannels[ch.id] = true;

        let exampleChannel = ch.guild.channels.get(Configuration.Zelforganisatie.RequiredPermissionsBaseChannelId);

        // Copy the permissions from the example channel
        for(let entry of exampleChannel.permissionOverwrites.entries()) {
            let allowed = new Discord.Permissions(entry[1].allow);
            let denied = new Discord.Permissions(entry[1].deny);
            let perms = {};
            for (perm in Discord.Permissions.FLAGS)
                perms[perm] = null;
            for (perm in allowed.serialize())
                perms[perm] = true;
            for (perm in denied.serialize())
                perms[perm] = false;

            ch.overwritePermissions(entry[0], perms);
        }

        // Remove illegal permission overwrites
        for (let id of Configuration.Zelforganisatie.BannedOverwriteIds) {
            if (ch.permissionOverwrites.has(id)) {
                await ch.permissionOverwrites.get(id).delete().catch(errorHandler);
            }
        }

        // Start listening again
        delete Zelforganisatie.updatingChannels[ch.id];
    },

    createChannel(member) {
        let newChannelName = member.user.username.toLowerCase().replace(/[^a-z]+/g, '-');
        let parentId = -1;
        for (let categoryId of Configuration.Zelforganisatie.CategoryIds) {
            let category = member.guild.channels.get(categoryId);
            if (category && category.children.size < 50) {
                parentId = category.id;
                break;
            }
        }
        if (parentId == -1) {
            errorHandler('Could not find Zelforganisatie category with less than 50 channels for ' + member);
            return;
        }

        member.guild.createChannel(newChannelName, {
            type: 'TEXT',
            parent: parentId,
            permissionOverwrites: [
                {
                    id: member.guild.id,
                    deny: ['VIEW_CHANNEL']
                },
                {
                    id: member.user.id,
                    allow: ['MANAGE_CHANNELS', 'VIEW_CHANNEL', 'MANAGE_MESSAGES', 'SEND_MESSAGES', 'MANAGE_ROLES']
                },
                {
                    id: member.guild.me.user.id,
                    allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_ROLES', 'MANAGE_CHANNELS']
                }
            ]
        }).then(function(ch) {
            ch.send(
                Configuration.Zelforganisatie.WelcomeMessage
                .replace('{mention}', '<@' + member.user.id + '>')
                .replace('{username}', member.displayName)
            )
            .catch(errorHandler);

            Zelforganisatie.Database.setUserChannel(member.id, ch.id);
        }).catch(errorHandler);
    },

    Database: {
        setUserChannel(userId, channelId) {
            request.post(Configuration.Zelforganisatie.ApiUrl + '/save_channel.php', {
                form: { 'user': userId, 'channel': channelId }
            });
        },

        getUserChannel(userId, callback) {
            request.get(Configuration.Zelforganisatie.ApiUrl + '/channels.json', function(e, s, b) {
                callback(JSON.parse(b)[userId]);
            });
        },

        deleteUserChannel(userId) {
            request.post(Configuration.Zelforganisatie.ApiUrl + '/delete_channel.php', {
                form: { 'user': userId }
            });
        },

        deleteChannel(channelId) {
            request.post(Configuration.Zelforganisatie.ApiUrl + '/delete_channel.php', {
                form: { 'channel': channelId }
            });
        },

        userHasChannel(userId, callback) {
            request.get(Configuration.Zelforganisatie.ApiUrl + '/has_channel.php?user=' + member.user.id, function(e, s, b) {
                callback(b.toUpperCase() == 'TRUE');
            });
        },

        getChannels(callback) {
            request.get(Configuration.Zelforganisatie.ApiUrl + '/channels.json', function(e, s, b) {
                callback(JSON.parse(b));
            });
        },

        getUsers(callback) {
            request.get(Configuration.Zelforganisatie.ApiUrl + '/users_with_channels.php', function(e, s, b) {
                let userIDs = b.split(/\s+/);
                callback(userIDs);
            });
        }
    }
}

// Message Restrictions
let MessageRestrictions = {

    enable(client) {
        client.on('message', msg => {
            let restrictions = Configuration.MessageRestrictions.Channels[msg.channel.id];
            if (typeof restrictions == 'undefined')
                return;

            // URL message exceptions
            if (restrictions.ExceptUrls && msg.content.match(/^https?:\/\//))
                return;

            let violations = [];
            if (restrictions.MinLength && msg.content.length < restrictions.MinLength)
                violations.push('TooShort');
            if (restrictions.MaxLength && msg.content.length > restrictions.MaxLength)
                violations.push('TooLong');
            if (restrictions.BlockUrls && msg.content.match(/https?:\/\//))
                violations.push('ContainsUrl');

            if (violations.lenght == 0)
                return;

            let messageBuffer = Configuration.MessageRestrictions.Messages.MessageDeleted;
            for (violation of violations) {
                messageBuffer +=
                    "\n" +
                    Configuration.MessageRestrictions.Messages.ListIcon +
                    Configuration.MessageRestrictions.Messages[violation]
                        .replace('{length}', message.content.length)
                        .replace('{channel}', message.channel);
            }
            message.author.send(messageBuffer).catch(errorHandler);
            message.delete().catch(errorHandler);
        });
    }
}

function isBotAdmin(member) {
    return member.hasPermission('MANAGE_GUILD') || Configuration.General.Developers.indexOf(member.user.id) > -1;
}

function errorHandler() {
    if (!Configuration.General.LogChannelId) {
        console.log(arguments);
        return;
    }

    let ch = client.channels.get(Configuration.General.LogChannelId);
    if (typeof ch == 'undefined') {
        console.log('COULD NOT FIND LOG CHANNEL');
        console.log.apply(console, arguments);
        return;
    }
    ch.send('Console output @ ' + new Date().toUTCString() + ':\n```' + JSON.stringify(Array.from(arguments)) + '```').catch(console.log);
    console.log.apply(console, arguments);
}

client.once("ready", () => {
  errorHandler(`Logged in as ${client.user.tag}. version 3.0.0!`);
});

// Enable modules
Commands.enable(client);
if (Configuration.MessageRestrictions.Enabled)
    MessageRestrictions.enable(client);
if (Configuration.Zelforganisatie.Enabled)
    Zelforganisatie.enable(client, Commands);
if (Configuration.Feed.Enabled) {
    Patcher.enableOldReactionListeners(client);
    Feed.enable(client);
}

// Run!
client.login(Configuration.General.BotToken);
