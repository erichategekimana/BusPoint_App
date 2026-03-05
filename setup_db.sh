#!/bin/bash
# This script helps set up the postgresql database, creates the user/role, runs the table creation script, and create python environment.




echo "Checking system requirements..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null
then
    echo "Error: PostgreSQL is not installed on this system."
    read -p  "Do you want to install it now(Y/N)?" user1
    if [[ "$user1" =~ ^([yY][eE][sS]|[yY])$ ]]; then
	    echo "Starting installation..."
	    sudo apt update && sudo apt install -y postgresql postgresql-contrib
	    echo ""
	    echo "Installing PostGis..."
	    sudo apt install postgis
	else
		
	    echo "Please install it using: sudo apt update && sudo apt install postgresql postgresql-contrib"
	    echo ""
	    exit 1
	  fi
else
    echo "PostgreSQL found."
fi


# Check if the PostgreSQL service is actually running
if ! systemctl is-active --quiet postgresql
then
    echo "PostgreSQL service is not running."
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql
fi




echo "Setting up the PostgreSQL database..."
echo ""
echo ""

# This will run table creation script(create tables, indexes, etc.)
echo "Initialize the Database structure..."
sudo -u postgres psql -d postgres -f database_setup.sql

echo "Database setup complete!"

# Add the database URI to .bashrc for easy access in the future

sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
echo "export BP_POSTGRES_DATABASE_URI=\'postgresql://postgres:postgres@localhost:5432/buspoint_db\'" >> ~/.bashrc
echo ""


# Define the name of the virtual environment folder
VENV_DIR=".venv"

echo "Checking for Python virtual environment..."

# 1. Check if the directory exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtual environment not found. Creating it now..."
    
    # Check if python3-venv is installed (common issue on Ubuntu)
    if ! dpkg -l | grep -q python3-venv; then
        echo "python3-venv is missing. Installing it..."
        sudo apt update && sudo apt install -y python3-venv
    fi

    python3 -m venv $VENV_DIR
    echo "Virtual environment created at $VENV_DIR."
else
    echo "Virtual environment found."
fi



# 2. Activate and update pip/dependencies
echo "Installing/Updating dependencies..."
source $VENV_DIR/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo "Dependencies installed."
else
    echo "requirements.txt not found. Skipping package installation."
fi


echo ""
echo "Database URI added to .bashrc. Please run 'source ~/.bashrc' to apply the changes."
echo ""
read -p "Press Enter to quit..."
