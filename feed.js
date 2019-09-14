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
            '\uD83D\uDD34': '508676723273891840' // :red_circle: -> #burgerwacht
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
            TooShort: 'Je bericht is korter dan {length} tekens, de minimale lengte in dit kanaal. Als je bericht langer is, splits die dan in meerdere stukken.',
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
        WelcomeMessage: 'Welkom in je eigen kanaal, {username}. Je kunt mensen toevoegen met !add @persoon en verwijderen met !remove @persoon. Zie <#618422819298082829> voor meer informatie.'
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
                .setTitle('Bericht in #' + channel.name + ' verstuurd door ' + user.username);

            feedChannel.send(message.url, embed).catch(errorHandler);
            errorHandler('Verstuurd door ' + message.author + ' in ' + message.channel);
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
};

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
                let overwriteId;
                
                let addMember = m.mentions.users.first();
                let addRole = m.mentions.roles.first();
                if (typeof addMember != 'undefined') {
                    overwriteId = addMember.id;
                } else if (typeof addRole != 'undefined') {
                    overwriteId = addRole.id;
                } else {
                    u.send('Het commando is: ' + Configuration.Commands.Prefix + 'add @gebruiker of ' + Configuration.Commands.Prefix + 'add @rol').catch(errorHandler);
                    return true;
                }
                
                channel.overwritePermissions(overwriteId, {
                    'VIEW_CHANNEL': true,
                    'SEND_MESSAGES': true,
                    'EMBED_LINKS': true,
                    'ATTACH_FILES': true,
                    'USE_EXTERNAL_EMOJIS': true,
                    'ADD_REACTIONS': true,
                    'READ_MESSAGE_HISTORY': true,
                    'MENTION_EVERYONE': false,
                    'MANAGE_WEBHOOKS': false,
                    'CREATE_INSTANT_INVITE': false
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
                let overwriteId;
                
                let removeMember = m.mentions.users.first();
                let removeRole = m.mentions.roles.first();
                if (typeof removeMember != 'undefined') {
                    overwriteId = removeMember.id;
                } else if (typeof removeRole != 'undefined') {
                    overwriteId = removeRole.id;
                } else {
                    u.send('Het commando is: ' + Configuration.Commands.Prefix + 'remove @gebruiker of ' + Configuration.Commands.Prefix + 'remove @rol').catch(errorHandler);
                    return true;
                }
                
                channel.overwritePermissions(overwriteId, {
                    'VIEW_CHANNEL': false,
                    'SEND_MESSAGES': false
                }).catch(errorHandler);
                u.send('Je hebt ' + removeMember + ' verwijderd uit ' + channel).catch(errorHandler);
                return true;
            });
        });
        commands.addCommand('leave', (g, u, c, a, m) => {
            let channel = m.mentions.channels.first();
            if (typeof channel == 'undefined') {
                u.send('Gebruik: !leave #kanaal').catch(errorHandler);
                return true;
            }
            Zelforganisatie.Database.getChannels((channels) => {
                console.log(channels);
                for(userId in channels) {
                    if (userId == u.id) {
                        u.send('Je kunt je eigen kanaal ' + channel + ' niet verlaten.').catch(errorHandler);
                        return;
                    }
                    let channelId = channels[userId];
                    if (channelId == channel.id) {
                        channel.overwritePermissions(u.id, {
                            'VIEW_CHANNEL': false
                        });
                        u.send('Je hebt het kanaal ' + channel + ' verlaten.').catch(errorHandler);
                        return;
                    }
                }
                u.send('Je kunt het kanaal ' + channel + ' niet verlaten.').catch(errorHandler);
            });
            return true;
        });
        commands.addCommand('reset', (g, u, c, a, m) => {
            Zelforganisatie.Database.getUserChannel(u.id, (channelId) => {
                if (typeof channelId == 'undefined') {
                    u.send('Je hebt geen eigen kanaal wat je kunt resetten.').catch(errorHandler);
                    return true;
                }
                let channel = g.channels.get(channelId);
                if (a.length == 1 && a[1] == 'IAmVerySure') {
                    Zelforganisatie.Database.deleteUserChannel(u.id, () => {
                         Zelforganisatie.createChannel(m.member);
                         u.send('Je kanaal is gereset.').catch(errorHandler);
                    });
                } else
                    u.send('Typ `!reset IAmVerySure` om je kanaal ' + channel + ' te resetten.').catch(errorHandler);
                return true;
            });
        });
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
                    '- !zelforganisatie assign memberId kanaalId: Gebruiker eigenaar van kanaal maken\n' +
                    '- !zelforganisatie whois #kanaal: Eigenaar van kanaal weergeven\n' +
                    '- !zelforganisatie cleanup: Database opschonen'
                ).catch(errorHandler);
                return true;
            }

            // !zelforganisatie assign
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
            
            // !zelforganisatie whois
            if (subcommand == 'whois') {
                if (a.length != 1) {
                    u.send('Syntax: !zelforganisatie whois #kanaal').catch(errorHandler);
                    return true;
                }
                let channel = m.mentions.channels.first();
                if (typeof channel == 'undefined') {
                    u.send('Kanaal niet gevonden').catch(errorHandler);
                    return true;
                } 
                Zelforganisatie.Database.getChannels((channels) => {
                    for(let userId in channels) {
                        let channelId = channels[userId];
                        if (channelId == channel.id) {
                            u.send('Kanaal ' + channel + ' is van ' + g.members.get(userId)).catch(errorHandler);
                            break;
                        }
                    }
                });
            }

            // !zelforganisatie cleanup
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

            // !zelforganisatie create @member
            if (subcommand == 'create') {
                if (!a.length) {
                    u.send('Use /zelforganisatie create @User');
                    return true;
                }
                let newMember = m.mentions.members.first();
                Zelforganisatie.createChannel(newMember);
                return true;
            }
            
            // !zelforganistatie createAll
            if (subcommand == 'createAll') {
                Zelforganisatie.Database.getUsers(async function(userIDs) {
                    let nSkip = 0;
                    let nDo = 0;
                    let doIt = a.length == 1 && a[0] == 'IAmVerySure';
                    let role = g.roles.get(Configuration.Zelforganisatie.RequiredRoleId);
                    if (typeof role == 'undefined') {
                        errorHandler('Cannot find role ID ' + Configuration.Zelforganisatie.RequiredRoleId);
                        return;
                    }
                    for(let member of role.members.array()) {
                        // Create channel for members without channel
                        if (userIDs.indexOf(member.user.id) > -1) {
                            nSkip++;
                            continue;
                        }
                        nDo++;
                        if (doIt)
                            await Zelforganisatie.createChannel(member);
                    }
                    if (doIt)
                        u.send(nDo + " kanalen aangemaakt voor " + role.name + ", " + nSkip + " hadden al een kanaal.").catch(errorHandler);
                    else
                        u.send('Weet je zeker dat je ' + nDo + ' kanalen wil aanmaken? Typ dan `!zelforganisatie createAll IAmVerySure` in de server.').catch(errorHandler);
                });
            }

            // !zelforganisatie channels
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

    createChannel(member, callback) {
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
                    deny: ['MANAGE_MESSAGES', 'MANAGE_WEBHOOKS', 'SEND_TTS_MESSAGES', 'MENTION_EVERYONE', 'CREATE_INSTANT_INVITE', 'MANAGE_CHANNELS', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_ROLES', 'USE_EXTERNAL_EMOJIS', 'ATTACH_FILES', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY', 'ADD_REACTIONS']
                },
                {
                    id: member.user.id,
                    allow: ['MANAGE_CHANNELS', 'VIEW_CHANNEL', 'MANAGE_MESSAGES', 'SEND_MESSAGES', 'MANAGE_ROLES', 'ATTACH_FILES', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY', 'USE_EXTERNAL_EMOJIS', 'ADD_REACTIONS', 'SEND_TTS_MESSAGES'],
                    deny: ['MENTION_EVERYONE', 'CREATE_INSTANT_INVITE', 'MANAGE_WEBHOOKS']
                },
                {
                    id: member.guild.me.user.id,
                    allow: ['MANAGE_CHANNELS', 'VIEW_CHANNEL', 'MANAGE_MESSAGES', 'SEND_MESSAGES', 'MANAGE_ROLES', 'ATTACH_FILES', 'EMBED_LINKS', 'READ_MESSAGE_HISTORY', 'USE_EXTERNAL_EMOJIS', 'ADD_REACTIONS', 'SEND_TTS_MESSAGES'],
                    deny: ['MENTION_EVERYONE', 'CREATE_INSTANT_INVITE']
                }
            ]
        }).then(function(ch) {
            ch.send(
                Configuration.Zelforganisatie.WelcomeMessage
                .replace('{mention}', '<@' + member.user.id + '>')
                .replace('{username}', member.displayName)
            )
            .catch(errorHandler);

            Zelforganisatie.Database.setUserChannel(member.id, ch.id, callback);
        }).catch(errorHandler);
    },

    Database: {
        setUserChannel(userId, channelId, callback) {
            request.post({
                uri: Configuration.Zelforganisatie.ApiUrl + '/save_channel.php',
                form: { 'user': userId, 'channel': channelId }
            }, callback);
        },

        getUserChannel(userId, callback) {
            request.get(Configuration.Zelforganisatie.ApiUrl + '/channels.json', function(e, s, b) {
                callback(JSON.parse(b)[userId]);
            }, callback);
        },

        deleteUserChannel(userId, callback) {
            request.post({
                uri: Configuration.Zelforganisatie.ApiUrl + '/delete_channel.php',
                form: { 'user': userId }
            }, callback);
        },

        deleteChannel(channelId, callback) {
            request.post({
                uri: Configuration.Zelforganisatie.ApiUrl + '/delete_channel.php',
                form: { 'channel': channelId }
            }, callback);
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
