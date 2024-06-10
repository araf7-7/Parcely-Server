require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o4dtxo0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        // await client.connect();
        const userCollection = client.db("parcelDb").collection("user");
        const parcelCollection = client.db("parcelDb").collection("parcel");
        const reviewCollection = client.db("parcelDb").collection("reviews");

        // Helper function to validate ObjectId
        const isValidObjectId = (id) => {
            return ObjectId.isValid(id) && (String(new ObjectId(id)) === id);
        };
        // jwt api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })
        //middleware
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' })
                }
                req.decoded = decoded
                next();
            })
        }

        //Payment Intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price = 0 } = req.body;

            // Validate price
            if (price < 0.5) { // Stripe's minimum charge amount for USD is $0.50
                return res.status(400).send({ message: 'Amount must be at least $0.50' });
            }

            const amount = Math.round(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });
        // Parcel collection
        app.get('/parcel', async (req, res) => {
            const result = await parcelCollection.find().toArray();
            res.send(result);
        });
        app.get(`/parcel/:email`, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await parcelCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/parcel/g/:id', async (req, res) => {
            const id = req.params.id;
            if (!isValidObjectId(id)) {
                return res.status(400).send({ error: 'Invalid ID format' });
            }
            const query = { _id: new ObjectId(id) };
            const result = await parcelCollection.findOne(query);
            res.send(result);
        });

        app.post('/parcel', async (req, res) => {
            const item = req.body;
            const result = await parcelCollection.insertOne(item);
            res.send(result);
        });
        app.delete('/parcel/:id', async (req, res) => {
            const id = req.params.id;
            if (!isValidObjectId(id)) {
                return res.status(400).send({ error: 'Invalid ID format' });
            }
            const query = { _id: new ObjectId(id) };
            const result = await parcelCollection.deleteOne(query);
            res.send(result);
        });


        app.put('/parcel/u/:id', async (req, res) => {
            try {
                const id = req.params.id;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: "Invalid ID format" });
                }

                const filter = { _id: new ObjectId(id) };
                const options = { upsert: true };
                const addDeliveryMan = req.body;

                const deliveryManUpdate = {
                    $set: {
                        ...addDeliveryMan
                    }
                };

                const result = await parcelCollection.updateOne(filter, deliveryManUpdate, options);

                if (result.matchedCount === 0 && result.upsertedCount === 0) {
                    return res.status(404).json({ success: false, message: "Parcel not found" });
                }

                res.status(200).json({ success: true, message: "Updated successfully" });
            } catch (error) {
                console.error(error);
                res.status(500).json({ success: false, message: "An error occurred", error: error.message });
            }
        });



        //update api
        app.patch('/parcel/:id', verifyToken, async (req, res) => {
            try {
                const parcel = req.body;
                const id = req.params.id;

                if (!isValidObjectId(id)) {
                    return res.status(400).send({ error: 'Invalid ID format' });
                }

                const existingParcel = await parcelCollection.findOne({ _id: new ObjectId(id) });
                if (!existingParcel) {
                    return res.status(404).send({ error: 'Parcel not found' });
                }

                // Check if the parcel status is "On The Way", if yes, prevent the update
                if (existingParcel.status === 'On The Way') {
                    return res.status(403).send({ error: 'Updates are not allowed for parcels that are "On The Way"' });
                }

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: {
                        parcelType: parcel.parcelType,
                        Weight: parcel.Weight,
                        receiverName: parcel.receiverName,
                        receiverNo: parcel.receiverNo,
                        address: parcel.address,
                        latitude: parcel.latitude,
                        longitude: parcel.longitude,
                        price: parcel.price,
                        status: parcel.status
                    }
                };

                const result = await parcelCollection.updateOne(filter, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).send({ error: 'Parcel not found' });
                }

                res.send({ modifiedCount: result.modifiedCount });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'An error occurred while updating the parcel' });
            }
        });
        app.patch('/parcel/gone/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            if (!isValidObjectId(id)) {
                return res.status(400).send({ error: 'Invalid ID format' });
            }
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    ...item
                }
            };
            const result = await parcelCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.patch('/parcel/cancel/:id', async (req, res) => {
            try {
                const parcel = await parcelCollection.findById(req.params.id);
                if (!parcel) {
                    return res.status(404).json({ message: "Parcel not found" });
                }
                parcel.status = 'canceled';
                await parcel.save();
                res.status(200).json({ message: "Parcel status updated to canceled" });
            } catch (error) {
                res.status(500).json({ message: "Internal server error", error });
            }
        });

        // User collection
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const isExist = await userCollection.findOne({ email: user?.email || '' });
            if (isExist) return res.send(isExist);
            const options = { upsert: true };
            const query = { email: user?.email };
            const updateDoc = {
                $set: { ...user },
            };
            const result = await userCollection.updateOne(query, updateDoc, options);
            res.send(result);
        });
        //make delivery man
        app.patch('/users/deliveryMan/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Delivery Man'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        //make admin 
        app.patch('/users/admin/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.get('/users', async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email });
            res.send(result);
        });
        //delivery route
        app.get('/users/u/delivery', async (req, res) => {
            const result = await userCollection.find({ role: 'Delivery Man' }).toArray();
            res.send(result);
        });


        //delivery man
        app.get('/parcel/delivery/:email', async (req, res) => {
            const user = await userCollection.findOne({ email: req.params.email })
            if (!user) {
                return res.send('user not found')
            }
            const userId = user._id.toString()
            const parcels = await parcelCollection.find({ deliveryManId: userId }).toArray()
            res.send(parcels)
        })
        //review
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });
        app.post('/reviews', async (req, res) => {
            const item = req.body;
            const result = await reviewCollection.insertOne(item);
            res.send(result);
        })
        app.get('/reviews/deliveryManId/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const deliveryMan = await userCollection.findOne({ email });

                if (!deliveryMan || deliveryMan.role !== 'Delivery Man') {
                    return res.status(403).json({ message: 'Access Forbidden' });
                }

                const reviews = await reviewCollection.find({ deliveryMenId: deliveryMan._id.toString() }).toArray();
                res.json(reviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
                res.status(500).send("Internal Server Error");
            }
        });
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('server is running');
});

app.listen(port, () => {
    console.log(`parcelly is running on port ${port}`);
});
