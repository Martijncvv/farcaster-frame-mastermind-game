import { FrameRequest, getFrameMessage, getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { NextRequest, NextResponse } from 'next/server';
import { NEXT_PUBLIC_URL } from '../../config';

const colorMap: { [key: string]: string } = {
    r: '🔴',
    g: '🟢',
    b: '🔵',
    y: '🟡',
    o: '🟠',
    wh: '⚪',
    bl: '⚫',
};

interface IState {
    solution: string;
    guesses: string[];
    counter: number;
    gameWon: string;
}

const getRandomSolution = () => {
    const colors = ['r', 'g','b', 'y', "o"];
    return Array.from({ length: 4 }, () => colors[Math.floor(Math.random() * colors.length)]).join(',');
}



const checkGuess = (guess: string, solution: string) => {
    const result: any = [];
    const solutionChars = solution.split(',');
    const guessEmojis = guess.split(',').map((r) => colorMap[r]).join(' ');
    const guessChars: any  = guess.split(',');
    const length = guessChars.length;

    if (guessChars?.length !== 4) {
        return `invalid input`
    }

    // First pass to find black pegs (correct color and position)
    for (let i = 0; i < length; i++) {
        if (guessChars[i] === solutionChars[i]) {
            result.push('bl');
            // @ts-ignore
            solutionChars[i] = null; // Mark this solution character as matched
            guessChars[i] = null; // Mark this guess character as used
        }
    }

    // Second pass to find white pegs (correct color, wrong position)
    for (let i = 0; i < length; i++) {
        if (guessChars[i] !== null) { // Skip already matched guesses
            const index = solutionChars.findIndex((c) => c === guessChars[i]);
            if (index !== -1) {
                result.push('wh');
                // @ts-ignore
                solutionChars[index] = null; // Mark this solution character as matched
            }
        }
    }

    if (result.length === 0) {
        return `${guessEmojis} - None`;
    }

    const feedback =  result?.length > 0 ? result.map((r: any) => colorMap[r]).join(' ') : '';

    return `${guessEmojis} - ${feedback}`;
}

async function getResponse(req: NextRequest): Promise<NextResponse> {
    const body: FrameRequest = await req.json();
    const { isValid, message } = await getFrameMessage(body, { neynarApiKey: 'NEYNAR_ONCHAIN_KIT' });

    if (!isValid) {
        return new NextResponse('Message not valid', { status: 500 });
    }

    let guess = message?.input?.length > 0 ? message.input.toLowerCase() : '';
    // if no commass add them between each character
    // remove all spaces
    guess = guess.replace(/\s/g, '');
    // remove all dots
    guess = guess.replace(/\./g, '');
    if (guess.length === 4) {
        guess = guess.split('').join(',');
    }

    let state: IState = {
        solution: "",
        guesses: [],
        counter: 0,
        gameWon: "false",
    };

    let gameWonMessage

    try {
        if (message.state?.serialized) {
            const decodedState = decodeURIComponent(message.state.serialized);
            const parsedState = JSON.parse(decodedState);


            if (parsedState.solution) {
                if (parsedState.solution === guess) {
                    gameWonMessage = `You won in ${parsedState.counter + 1} tries! ${guess.split(',').map((r) => colorMap[r]).join('')} 🎉`
                    const feedback = checkGuess(guess, parsedState.solution);
                    state = {
                        solution: "",
                        guesses: [...parsedState.guesses, feedback],
                        counter: parsedState.counter + 1,
                        gameWon: "true",
                    };
                } else {
                    const feedback = checkGuess(guess, parsedState.solution);
                    state = {
                        solution: parsedState.solution,
                        guesses: [...parsedState.guesses, feedback],
                        counter: parsedState.counter + 1,
                        gameWon: "false",
                    };
                }
            } else {
                const newSolution = getRandomSolution()
                const feedback = checkGuess(guess, newSolution);
                state = {
                    ...parsedState,
                    solution : newSolution,
                    guesses: [feedback],
                    counter: parsedState.counter + 1,
                    gameWon: "false",
                };
            }
        }
    } catch (e) {
        console.error(e);
    }

    const imageUrl = `${NEXT_PUBLIC_URL}/api/background-image?state=${encodeURIComponent(JSON.stringify(state))}`;

    return new NextResponse(
        getFrameHtmlResponse({
            buttons: [
                {
                    label: `${gameWonMessage ? gameWonMessage : "Guess"} `,
                    action: 'post',
                    target: `${NEXT_PUBLIC_URL}/api/gameplay_easy`,
                },
            ],
            postUrl: `${NEXT_PUBLIC_URL}/api/gameplay_easy`,
            input: {
                text: 'Enter guess: r,g,b,y,o (4 total)',
            },
            image: {
                src: imageUrl,
            },
            state: {
                solution: state.solution,
                guesses: state.guesses,
                counter: state.counter,
                gameWon: state.gameWon,
            },
        }),
    );
}

export async function POST(req: NextRequest): Promise<Response> {
    return getResponse(req);
}

export const dynamic = 'force-dynamic';
