const { gql } = require("graphql-tag");

/**
 * GraphQL Schema for Artist Type
 * 
 * This schema defines the Artist type and queries for retrieving artist data
 * from the Supabase database.
 */
const artistTypeDefs = gql`
  """
  Artist represents a musical artist or performer
  """
  type Artist {
    """
    Unique identifier for the artist
    """
    id: ID!
    
    """
    Name of the artist
    """
    name: String!
    
    """
    URL-friendly slug for the artist
    """
    slug: String!
    
    """
    Biography or description of the artist
    """
    bio: String
    
    """
    Array of tags associated with the artist (genres, styles, etc.)
    """
    tags: [String]
  }

  type Query {
    """
    Get a single artist by their ID
    
    Returns the artist data if found, null otherwise
    """
    artist(id: ID!): Artist
    
    """
    Get multiple artists by their IDs
    
    Returns an array of artists found
    """
    artists(ids: [ID!]!): [Artist]
  }
`;

module.exports = artistTypeDefs;
