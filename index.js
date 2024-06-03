const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();

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
        await client.connect();
        const userCollection = client.db("parcelDb").collection("user");
        const parcelCollection = client.db("parcelDb").collection("parcel");

        // Helper function to validate ObjectId
        const isValidObjectId = (id) => {
            return ObjectId.isValid(id) && (String(new ObjectId(id)) === id);
        };

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
        //update route
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

        //update api
        app.patch('/parcel/:id', async (req, res) => {
            const parcel = req.body;
            const id = req.params.id;
            if (!isValidObjectId(id)) {
                return res.status(400).send({ error: 'Invalid ID format' });
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
                    price: parcel.price
                }
            };
            const result = await parcelCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // User collection
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            console.log(user);
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
            console.log(user);
            const result = await userCollection.updateOne(query, updateDoc, options);
            res.send(result);
        });
        //make delivery man
        app.patch('/users/deliveryMan/:id', async (req, res) => {
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
        app.patch('/users/admin/:id', async (req, res) => {
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

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
