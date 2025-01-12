import dotenv from 'dotenv';
import app from './app.js';
import env from './env.js';

const port = env.PORT;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
