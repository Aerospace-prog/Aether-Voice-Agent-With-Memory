"""Memory System component for storing and retrieving conversation memories."""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import math
from src.models import Memory


class MemorySystem:
    """Manages storage and retrieval of conversation memories.
    
    Provides methods to store memories with tags and context, retrieve memories
    ordered by recency, and search memories by tag filtering.
    All memories are stored in memory and automatically persisted to JSON file.
    Supports semantic search using OpenAI embeddings and cosine similarity.
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """Initialize the MemorySystem with persistent storage.
        
        Args:
            storage_path: Path to JSON storage file. Defaults to ~/.voice-agent/memories.json
        """
        self._memories: Dict[str, Memory] = {}
        
        # Set storage path
        if storage_path is None:
            storage_path = os.path.expanduser("~/.voice-agent/memories.json")
        self._storage_path = storage_path
        
        # Load existing memories from file
        self._load_from_file()
    
    def store_memory(self, content: str, tags: Optional[List[str]] = None, 
                    context: Optional[Dict] = None) -> str:
        """Stores a memory with metadata and returns the memory ID.
        
        Args:
            content: Memory content (must be non-empty)
            tags: Associated tags for categorization (optional, defaults to empty list)
            context: Additional context metadata (optional, defaults to empty dict)
            
        Returns:
            str: Unique identifier of the stored memory
            
        Raises:
            ValueError: If content is empty or whitespace-only
        """
        if not content or not content.strip():
            raise ValueError("Memory content cannot be empty")
        
        # Set defaults for optional parameters
        if tags is None:
            tags = []
        if context is None:
            context = {}
        
        memory_id = str(uuid.uuid4())
        timestamp = datetime.now()
        
        # Generate embedding if enabled
        embedding = None
        # Always try to generate embedding since it's local now
        embedding = self._generate_embedding(content)
        
        memory = Memory(
            id=memory_id,
            content=content,
            tags=tags,
            context=context,
            timestamp=timestamp,
            embedding=embedding
        )
        
        self._memories[memory_id] = memory
        self._save_to_file()
        return memory_id
    
    def retrieve_memories(self, query: Optional[str] = None, limit: Optional[int] = None) -> List[Memory]:
        """Retrieves memories ordered by relevance (if query provided) or recency.
        
        Args:
            query: Optional search query for semantic search. If provided and embeddings are available,
                   memories are ranked by cosine similarity. Otherwise, falls back to recency ordering.
            limit: Maximum number of memories to return (optional)
            
        Returns:
            List[Memory]: List of memories ordered by relevance (if query provided) or timestamp (newest first)
        """
        # If there's a query, use semantic search
        if query:
            return self._semantic_search(query, limit)
        
        # Otherwise, fall back to recency-based retrieval
        # Sort memories by timestamp in descending order (most recent first)
        sorted_memories = sorted(
            self._memories.values(),
            key=lambda m: m.timestamp,
            reverse=True
        )
        
        # Apply limit if specified
        if limit is not None and limit > 0:
            return sorted_memories[:limit]
        
        return sorted_memories
    
    def search_memories(self, tags: Optional[List[str]] = None, 
                       content_query: Optional[str] = None) -> List[Memory]:
        """Searches memories with tag filtering and optional content matching.
        
        Args:
            tags: List of tags to filter by (returns memories with ANY of these tags)
            content_query: Optional string to search for in memory content (case-insensitive)
            
        Returns:
            List[Memory]: List of matching memories ordered by recency (newest first)
        """
        results = []
        
        for memory in self._memories.values():
            # Check tag filter
            if tags is not None and len(tags) > 0:
                # Memory must have at least one of the specified tags
                if not any(tag in memory.tags for tag in tags):
                    continue
            
            # Check content query
            if content_query is not None and content_query.strip():
                # Case-insensitive content search
                if content_query.lower() not in memory.content.lower():
                    continue
            
            results.append(memory)
        
        # Sort by recency (most recent first)
        results.sort(key=lambda m: m.timestamp, reverse=True)
        return results
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text using SentenceTransformers.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List[float]: Embedding vector
            
        Raises:
            Exception: If embedding generation fails
        """
        try:
            from sentence_transformers import SentenceTransformer
            if not hasattr(self, '_embedding_model'):
                self._embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            
            # encode returns a numpy array, we need a list of floats
            embedding = self._embedding_model.encode(text)
            return embedding.tolist()
        except Exception as e:
            # Log error but don't fail the entire operation
            print(f"Warning: Failed to generate embedding: {e}")
            return None
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            float: Cosine similarity score between -1 and 1
        """
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        
        # Calculate dot product
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        
        # Calculate magnitudes
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        
        # Avoid division by zero
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        
        return dot_product / (magnitude1 * magnitude2)
    
    def _semantic_search(self, query: str, limit: Optional[int] = None) -> List[Memory]:
        """Search memories using semantic similarity.
        
        Args:
            query: Search query text
            limit: Maximum number of results to return
            
        Returns:
            List[Memory]: Memories ordered by relevance (highest similarity first)
        """
        # Generate embedding for query
        query_embedding = self._generate_embedding(query)
        if query_embedding is None:
            # Fall back to recency if embedding generation fails
            return self.retrieve_memories(query=None, limit=limit)
        
        # Calculate similarity scores for all memories with embeddings
        scored_memories = []
        for memory in self._memories.values():
            if memory.embedding is not None:
                similarity = self._cosine_similarity(query_embedding, memory.embedding)
                scored_memories.append((memory, similarity))
        
        # Sort by similarity score (highest first)
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        
        # Extract just the memories
        results = [memory for memory, score in scored_memories]
        
        # Apply limit if specified
        if limit is not None and limit > 0:
            return results[:limit]
        
        return results
    
    def _load_from_file(self) -> None:
        """Load memories from JSON file.
        
        Creates the storage directory and file if they don't exist.
        Handles file I/O errors gracefully by starting with empty storage.
        """
        try:
            # Check if file exists
            if not os.path.exists(self._storage_path):
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
                # Start with empty storage
                self._memories = {}
                return
            
            # Read and parse JSON file
            with open(self._storage_path, 'r') as f:
                content = f.read().strip()
                # Handle empty file
                if not content:
                    self._memories = {}
                    return
                data = json.loads(content)
            
            # Deserialize memories
            self._memories = {}
            for memory_dict in data:
                memory = Memory.from_dict(memory_dict)
                self._memories[memory.id] = memory
                
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            # Handle corrupted or invalid JSON data
            raise IOError(f"Failed to load memories from {self._storage_path}: {e}")
        except OSError as e:
            # Handle file system errors (permissions, etc.)
            raise IOError(f"Failed to read memories file {self._storage_path}: {e}")
    
    def _save_to_file(self) -> None:
        """Save memories to JSON file.
        
        Ensures data consistency by writing to a temporary file first,
        then atomically replacing the original file.
        
        Raises:
            IOError: If file write operation fails
        """
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
            
            # Serialize all memories
            data = [memory.to_dict() for memory in self._memories.values()]
            
            # Write to temporary file first for atomic operation
            temp_path = self._storage_path + '.tmp'
            with open(temp_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Atomically replace the original file
            os.replace(temp_path, self._storage_path)
            
        except OSError as e:
            # Handle file system errors (permissions, disk full, etc.)
            raise IOError(f"Failed to save memories to {self._storage_path}: {e}")
