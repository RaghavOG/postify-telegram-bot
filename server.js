import { Telegraf } from "telegraf";
import userModel from "./src/models/user.model.js";
import { message } from "telegraf/filters";
import connectDB from "./src/config/db.js";
import eventModel from "./src/models/event.model.js";
import OpenAI from "openai";

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env["OPEN_AI_API_KEY"]
});

// Connect to the database
try {
    connectDB();
    console.log("Database connected successfully");
} catch (error) {
    console.log("Error in connecting to the database: ", error);
    process.kill(process.pid, 'SIGTERM');
}

const bot = new Telegraf(process.env.BOT_TOKEN);
console.log("Bot is Starting");

// Command to stop the bot
bot.command('quit', async (ctx) => {
    await ctx.reply("Bot is stopping. Goodbye!");
});

// Command to greet the user and save them in the database
bot.start(async (ctx) => {
    const from = ctx.update.message.from;

    try {
        await userModel.findOneAndUpdate({ tgId: from.id }, {
            $setOnInsert: {
                firstName: from.first_name,
                lastName: from.last_name,
                isBot: from.is_bot,
                username: from.username
            }
        }, { upsert: true, new: true });

        await ctx.reply(`Hello ${from.first_name}! Welcome. I will be writing highly engaging social media posts for you. Just keep feeding me with the events throughout the day. Let's shine on social media together!`);

    } catch (error) {
        console.log("Error", error);
        await ctx.reply("There was an error while processing your request. Please try again later.");
    }
});

// Command to generate social media posts based on today's events
bot.command("generate", async (ctx) => {
    const { message_id: waitingMessage } = await ctx.reply(`Hey ${ctx.update.message.from.first_name}! I am generating the social media posts for you. Please wait for a moment.`);
    const { message_id: loadingSticker } = await ctx.replyWithSticker("CAACAgUAAxkBAAMiZtLg2385UKB10wF0lkaigIwkqgkAApoEAAICLmhU_1EES77w3ao1BA");

    // Get all today's events
    const events = await eventModel.find({
        tgId: ctx.update.message.from.id,
        createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
    });

    if (events.length === 0) {
        await ctx.deleteMessage(waitingMessage);
        await ctx.deleteMessage(loadingSticker);
        await ctx.reply("No events found for today");
        return;
    }

    console.log(events);

    try {
        
        // Placeholder for OpenAI API call - Uncomment and configure as needed
        // const chatCompletion = await openai.chat.completions.create({...});

        await ctx.deleteMessage(waitingMessage);
        await ctx.deleteMessage(loadingSticker);

        // Uncomment below when OpenAI is configured
        // await ctx.reply(chatCompletion.data.choices[0].message.content);

        await ctx.reply("Here are the social media posts for today\n\n");
        await ctx.reply(events.map((event) => event.text).join(", "));

    } catch (error) {
        console.log("Error in generating", error);
        await ctx.reply("There was an error generating the posts. Please try again later.");
    }
});

// New Command: /time - Shows current server time
bot.command('time', async (ctx) => {
    const currentTime = new Date().toLocaleTimeString();
    await ctx.reply(`Current server time is: ${currentTime}`);
});

// New Command: /help - Lists all commands
bot.command('help', async (ctx) => {
    await ctx.reply(`
Available commands:
/start - Start interacting with the bot
/generate - Generate social media posts from today's events
/time - Show the current server time
/deleteevents - Delete all events for today
/stats - Show the number of events recorded today
/about - Learn more about this bot
/quit - Stop the bot
`);
});

// New Command: /deleteevents - Deletes all today's events
bot.command('deleteevents', async (ctx) => {
    try {
        await eventModel.deleteMany({
            tgId: ctx.update.message.from.id,
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        });
        await ctx.reply("All today's events have been deleted.");
    } catch (error) {
        console.log("Error deleting events", error);
        await ctx.reply("Failed to delete events. Please try again.");
    }
});

// New Command: /stats - Shows the count of today's events
bot.command('stats', async (ctx) => {
    const count = await eventModel.countDocuments({
        tgId: ctx.update.message.from.id,
        createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
    });
    await ctx.reply(`You have recorded ${count} event(s) today.`);
});

// New Command: /about - Provides info about the bot
bot.command('about', async (ctx) => {
    await ctx.reply("I am a social media bot designed to help you generate engaging posts based on your daily events. Use the commands to interact and make the most out of your social media presence!");
});

// Text handler for greetings and thanks
bot.on(message("text"), async (ctx) => {
    const from = ctx.update.message.from;
    const messageText = ctx.update.message.text;

    if (["Thank you", "Thanks", "Thank you!", "Thanks!"].includes(messageText)) {
        return await ctx.reply("You're welcome!");
    }

    if (["Hi", "Hello", "Hey"].includes(messageText)) {
        return await ctx.reply(`Hello ${from.first_name}!`);
    }

    // Record the event
    try {
        await eventModel.create({
            text: messageText,
            tgId: from.id
        });
        await ctx.reply("Event has been added successfully");
        console.log(messageText);

    } catch (error) {
        console.log("Error", error);
        await ctx.reply("There was an error adding your event. Please try again.");
    }
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch();
