import express from 'express';
import bodyParser from 'body-parser';
import Discord from 'discord.js';
import { Message } from 'discord.js';
import { MongoClient } from 'mongodb';
import Commands from './commands';
import Events from './events';
import config from './config';

const app = express();
const bot = new Discord.Client();

app.use(bodyParser.json());

// webhook POST -> construct message -> send message
app.post('/', (req, res) => {
  // @TODO Verify that this request came from GitHub
  const event = req.get("X-GitHub-Event");
  if (event) {
    const message = Events[event](req.body);
    const repo = req.body.repository.full_name.toLowerCase();
    sendMessages(repo, message);
    res.sendStatus(200);
  } else {
    res.sendStaus(400);
  }
});

app.get('/', (req, res) => {
  res.send('This address is not meant to be accessed by a web browser. Please read the readme on GitHub');
});

function sendMessages(repo, message) {
  MongoClient.connect(config.db, (err, db) => {
    if (err) reject(err);
    db.collection('subscriptions').find({
      'repo': repo
    })
    .toArray((err, subscriptions) => {
      db.close();
      subscriptions.forEach(subscription => {
        const channel = bot.channels.find('id', subscription.channelId);
        if (channel) {
          channel.sendMessage(message);
        } else {
          console.log('Error: Bot not allowed in channel');
        }
      });
    });
  });
}

// discord message event -> parseMessage -> Command -> Action
/**
 * Check to see if any message read by this bot is relevant.
 * - Do nothing if the message is from the bot itself.
 * - Check if the message is prefaced with '!dbg'.
 * - If the command is prefaced, check if the command exists.
 * - Then perform the action sepcified.
 */
bot.on('message', (message) => {
  if (message.author.id === bot.user.id) return;
  if (message.content.substring(0, 4) !== '!dbg') return;

  const commandObject = parseMessage(message);
  if (commandObject) {
    Commands[commandObject.command](message.channel, ...commandObject.args);
  } else {
    message.reply('Command invalid.');
    Commands['help'];
  }
});

/**
 * Take in the content of a message and return a command
 * @param  {Message} message The Discord.Message object
 * @return {Object}          An object continaing a command name and arguments
 */
function parseMessage(message) {
  const parts = message.content.split(' ');
  const command = parts[1];
  const args = parts.slice(2);

  if (typeof Commands[command] === 'function') {
    // @TODO We could check the command validity here
    return { command, args };
  } else {
    return null;
  }
}

app.listen(process.env.PORT || 8080, () => {
  bot.login(config.token)
  .then(console.log('Logged in.'))
  .catch(error => console.log(error));
});
