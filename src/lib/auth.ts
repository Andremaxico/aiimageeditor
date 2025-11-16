import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Polar } from "@polar-sh/sdk";
import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { db } from "~/server/db";
import { env } from "~/env";
// If your Prisma file is located elsewhere, you can change the path

console.log('polar access token', env.POLAR_ACCESS_TOKEN)

const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: 'sandbox'
});

const prisma = new PrismaClient();
export const auth = betterAuth({
    emailAndPassword: { 
        enabled: true, 
    }, 
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    plugins: [
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [
                        {
                            productId: "2be06783-3683-4ac6-b671-d10251fa8555",
                            slug: "small",
                        },
                        {
                            productId: "69ac6756-f0ed-48f5-9b7f-7dfbbb006f23",
                            slug: "medium",
                        },
                        {
                            productId: "2be06783-3683-4ac6-b671-d10251fa8555",
                            slug: "large",
                        },
                    ],
                    successUrl: "/dashboard",
                    authenticatedUsersOnly: true,
                }),
                portal(),
                webhooks({
                    secret: env.POLAR_WEBHOOK_SECRET!,
                    onOrderPaid: async (order) => {
                        const externalCustomerId = order.data.customer.externalId;

                        if (!externalCustomerId) {
                            console.error("No external customer ID found.");
                            throw new Error("No external customer id found.");
                        }

                        const productId = order.data.productId;

                        let creditsToAdd = 0;

                        switch (productId) {
                            case "215197d3-8ef2-44cb-92cf-7ff67e9382e9":
                                creditsToAdd = 50;
                                break;
                            case "ab3f61e7-d70a-4f9a-8b8b-e41883d92002clear":
                                creditsToAdd = 200;
                                break;
                            case "e4e75526-e776-483f-9ff3-5b65f8ff520e":
                                creditsToAdd = 500;
                                break;
                        }

                        await db.user.update({
                            where: { id: externalCustomerId },
                            data: {
                                credits: {
                                    increment: creditsToAdd,
                                },
                            },
                        });
                    }
                }),
            ],
        }),
    ],
});